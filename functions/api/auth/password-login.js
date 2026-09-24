import { authHash, authPepper, bad, ensureCustomerSchema, json, normalizeCustomerIdentifier, sameOriginRequest, verifyPassword, createCustomerSession, customerSessionCookie, validatePassword, cleanString } from '../_shared.js';

export async function onRequestPost(context) {
  if (!sameOriginRequest(context.request)) return bad('درخواست نامعتبر است.', 403);
  if (!context.env?.DB) return bad('اتصال حساب کاربری به دیتابیس برقرار نیست.', 500);
  const body = await context.request.json().catch(() => null);
  const identifier = normalizeCustomerIdentifier(body?.identifier);
  const password = String(body?.password || '');
  const err = validatePassword(password);
  if (!identifier || err) return bad('ایمیل یا رمز عبور نادرست است.');
  await ensureCustomerSchema(context.env.DB);
  const pepper = await authPepper(context.env);
  const ip = cleanString(context.request.headers.get('CF-Connecting-IP') || '', 96) || 'unknown';
  const attemptKey = await authHash(`password-login:${identifier.type}:${identifier.value}:${ip}`, pepper);
  const attempt = await context.env.DB.prepare('SELECT fail_count AS failCount,locked_until AS lockedUntil FROM customer_auth_attempts WHERE key_hash=? LIMIT 1').bind(attemptKey).first();
  if (Number(attempt?.lockedUntil || 0) > Date.now()) return bad('تعداد تلاش برای ورود زیاد است. چند دقیقه بعد دوباره امتحان کنید.', 429);
  if (identifier.type !== 'email') return bad('ایمیل یا رمز عبور نادرست است.');
  const customer = await context.env.DB.prepare('SELECT id,email,display_name AS displayName,password_hash AS passwordHash,password_salt AS passwordSalt,email_verified AS emailVerified FROM customers WHERE email=? LIMIT 1').bind(identifier.value).first();
  if (!customer?.passwordHash || !customer?.passwordSalt || !Number(customer.emailVerified)) {
    const fails=Math.min(20,Number(attempt?.failCount||0)+1);
    const locked=fails>=8?Date.now()+15*60*1000:0;
    await context.env.DB.prepare('INSERT INTO customer_auth_attempts(key_hash,fail_count,locked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET fail_count=excluded.fail_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at').bind(attemptKey,fails,locked,Date.now()).run();
    return bad('اطلاعات ورود نادرست است.', 401);
  }
  const ok = await verifyPassword(password, customer.passwordSalt, customer.passwordHash);
  if (!ok) {
    const fails=Math.min(20,Number(attempt?.failCount||0)+1);
    const locked=fails>=8?Date.now()+15*60*1000:0;
    await context.env.DB.prepare('INSERT INTO customer_auth_attempts(key_hash,fail_count,locked_until,updated_at) VALUES(?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET fail_count=excluded.fail_count,locked_until=excluded.locked_until,updated_at=excluded.updated_at').bind(attemptKey,fails,locked,Date.now()).run();
    return bad('اطلاعات ورود نادرست است.', 401);
  }
  await context.env.DB.prepare('DELETE FROM customer_auth_attempts WHERE key_hash=?').bind(attemptKey).run();
  const session = await createCustomerSession(context.env.DB, customer.id);
  return json({ ok:true, authenticated:true, profile:publicProfile(customer) }, 200, { 'set-cookie': customerSessionCookie(session.raw) });
}

function publicProfile(row) {
  return { id: row.id, email: row.email || '', displayName: row.displayName || 'کاربر PetRaPet', emailVerified: Boolean(row.emailVerified), hasPassword: true };
}
