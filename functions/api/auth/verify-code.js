import { authHash, authPepper, bad, cleanString, createCustomerSession, customerSessionCookie, ensureCustomerSchema, json, normalizeCustomerIdentifier, sameOriginRequest } from '../_shared.js';

export async function onRequestPost(context) {
  if (!sameOriginRequest(context.request)) return bad('درخواست نامعتبر است.', 403);
  if (!context.env?.DB) return bad('اتصال حساب کاربری به دیتابیس برقرار نیست.', 500);
  const body = await context.request.json().catch(() => null);
  const identifier = normalizeCustomerIdentifier(body?.identifier);
  const code = cleanString(body?.code, 12).replace(/\D/g, '');
  if (!identifier || identifier.type !== 'email' || code.length !== 6) return bad('ایمیل یا کد تأیید نامعتبر است.');

  await ensureCustomerSchema(context.env.DB);
  const pepper = await authPepper(context.env);
  const identifierHash = await authHash(`${identifier.type}:${identifier.value}`, pepper);
  const row = await context.env.DB.prepare(`SELECT id,customer_id AS customerId,code_hash AS codeHash,code_salt AS codeSalt,attempts,expires_at AS expiresAt
    FROM customer_otps WHERE identifier_hash=? AND channel='email' AND consumed=0 ORDER BY created_at DESC LIMIT 1`).bind(identifierHash).first();
  if (!row) return bad('کد تأیید پیدا نشد یا منقضی شده است.', 400);
  if (Number(row.expiresAt) <= Date.now()) return bad('کد تأیید منقضی شده است.', 400);
  if (Number(row.attempts) >= 5) return bad('تعداد تلاش برای این کد تمام شده است.', 429);

  const expected = String(row.codeHash || '');
  const got = await authHash(`${identifierHash}:${row.codeSalt}:${code}`, pepper);
  let diff = expected.length ^ got.length;
  for (let i = 0; i < Math.max(expected.length, got.length); i++) diff |= (expected.charCodeAt(i) || 0) ^ (got.charCodeAt(i) || 0);
  if (diff !== 0) {
    const attempts = Number(row.attempts || 0) + 1;
    await context.env.DB.prepare('UPDATE customer_otps SET attempts=? WHERE id=?').bind(attempts, row.id).run();
    return bad(attempts >= 5 ? 'کد اشتباه است و این کد دیگر قابل استفاده نیست.' : 'کد تأیید اشتباه است.', 400);
  }

  const now = new Date().toISOString();
  await context.env.DB.prepare('UPDATE customer_otps SET consumed=1 WHERE id=?').bind(row.id).run();
  await context.env.DB.prepare('UPDATE customers SET email_verified=1,updated_at=? WHERE id=?').bind(now,row.customerId).run();
  const customer = await context.env.DB.prepare('SELECT id,email,display_name AS displayName,password_hash AS passwordHash,email_verified AS emailVerified FROM customers WHERE id=? LIMIT 1').bind(row.customerId).first();
  const session = await createCustomerSession(context.env.DB, row.customerId);
  const headers = { 'set-cookie': customerSessionCookie(session.raw) };
  return json({ ok: true, authenticated: true, needsPassword: !customer.passwordHash, profile: publicProfile(customer) }, 200, headers);
}

function publicProfile(row) {
  return {
    id: row.id, email: row.email || '',
    displayName: row.displayName || 'کاربر PetRaPet',
    emailVerified: Boolean(row.emailVerified),
    hasPassword: Boolean(row.passwordHash)
  };
}
