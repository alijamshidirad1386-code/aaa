import { authHash, authPepper, bad, cleanString, ensureCustomerSchema, json, normalizeCustomerIdentifier, sameOriginRequest, sendCustomerOtp } from '../_shared.js';

export async function onRequestPost(context) {
  if (!sameOriginRequest(context.request)) return bad('درخواست نامعتبر است.', 403);
  if (!context.env?.DB) return bad('اتصال حساب کاربری به دیتابیس برقرار نیست.', 500);

  const body = await context.request.json().catch(() => null);
  const identifier = normalizeCustomerIdentifier(body?.identifier);
  if (!identifier) return bad('لطفاً یک ایمیل معتبر وارد کنید.');

  try {
    await ensureCustomerSchema(context.env.DB);
  } catch (schemaError) {
    console.error('PetRaPet customer schema error:', schemaError);
    return bad('ساختار حساب کاربری در Cloudflare D1 آماده نیست. اگر D1 وصل است، یک بار دیگر تلاش کنید.', 503);
  }
  const pepper = await authPepper(context.env);
  const identifierHash = await authHash(`${identifier.type}:${identifier.value}`, pepper);
  const ip = cleanString(context.request.headers.get('CF-Connecting-IP') || '', 96) || 'unknown';
  const ipHash = await authHash(`ip:${ip}`, pepper);
  const now = Date.now();
  const windowStart = now - 15 * 60 * 1000;

  const [byIdentifier, byIp] = await Promise.all([
    context.env.DB.prepare('SELECT COUNT(*) AS count FROM customer_otps WHERE identifier_hash=? AND created_at>?').bind(identifierHash, windowStart).first(),
    context.env.DB.prepare('SELECT COUNT(*) AS count FROM customer_otps WHERE ip_hash=? AND created_at>?').bind(ipHash, windowStart).first()
  ]);
  if (Number(byIdentifier?.count || 0) >= 3 || Number(byIp?.count || 0) >= 10) {
    return bad('تعداد درخواست کد زیاد است. ۱۵ دقیقه بعد دوباره تلاش کنید.', 429);
  }

  let customer;
  try {
    customer = await context.env.DB.prepare('SELECT id FROM customers WHERE email=? LIMIT 1').bind(identifier.value).first();
  } catch (dbError) {
    console.error('PetRaPet customer lookup error:', dbError);
    return bad('خواندن حساب کاربری از D1 انجام نشد.', 503);
  }
  let createdCustomerId = '';
  if (!customer) {
    const id = `customer_${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();
    try {
      await context.env.DB.prepare('INSERT INTO customers(id,email,display_name,created_at,updated_at) VALUES(?,?,?,?,?)')
        .bind(id, identifier.value, identifier.value.split('@')[0].slice(0, 80), nowIso, nowIso).run();
      customer = { id };
      createdCustomerId = id;
    } catch (insertError) {
      // A duplicate email can happen when two OTP requests arrive at the same
      // time. Re-read the row instead of turning that race into a 500.
      console.error('PetRaPet customer create error:', insertError);
      const existing = await context.env.DB.prepare('SELECT id FROM customers WHERE email=? LIMIT 1').bind(identifier.value).first().catch(() => null);
      if (!existing) return bad('ساخت حساب کاربری در D1 انجام نشد. لطفاً دوباره تلاش کنید.', 503);
      customer = existing;
    }
  }

  await context.env.DB.prepare('UPDATE customer_otps SET consumed=1 WHERE identifier_hash=? AND consumed=0').bind(identifierHash).run();
  const code = String(100000 + Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 900000));
  const salt = await cryptoSalt();
  const codeHash = await authHash(`${identifierHash}:${salt}:${code}`, pepper);
  const expiresAt = now + 10 * 60 * 1000;
  const otpId = `otp_${crypto.randomUUID()}`;

  await context.env.DB.prepare(`INSERT INTO customer_otps(id,customer_id,identifier_hash,channel,code_hash,code_salt,attempts,consumed,expires_at,created_at,ip_hash) VALUES(?,?,?,?,?,?,0,0,?,?,?)`)
    .bind(otpId, customer.id, identifierHash, 'email', codeHash, salt, expiresAt, now, ipHash).run();

  try {
    await sendCustomerOtp({ env: context.env, identifier, code });
  } catch (error) {
    await context.env.DB.prepare('UPDATE customer_otps SET consumed=1 WHERE id=?').bind(otpId).run().catch(() => {});
    if (createdCustomerId) {
      await context.env.DB.prepare('DELETE FROM customers WHERE id=? AND email_verified=0 AND password_hash IS NULL').bind(createdCustomerId).run().catch(() => {});
    }
    const message = String(error?.message || '');
    if (message.includes('EMAIL_PROVIDER_NOT_CONFIGURED')) return bad('ارسال ایمیل هنوز در تنظیمات Cloudflare فعال نشده است.', 503);
    return bad('ارسال کد ایمیل انجام نشد. کلید و آدرس فرستنده ایمیل را بررسی کنید.', 502);
  }

  return json({ ok: true, channel: 'email', expiresIn: 600, masked: maskEmail(identifier.value) }, 202);
}

async function cryptoSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function maskEmail(email) {
  const [name, domain] = email.split('@');
  const prefix = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`;
  return `${prefix}@${domain}`;
}
