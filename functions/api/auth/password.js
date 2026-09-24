import { bad, ensureCustomerSchema, json, requireCustomer, passwordHash, randomHex, sameOriginRequest, validatePassword, verifyPassword } from '../_shared.js';

export async function onRequestPut(context) {
  if (!sameOriginRequest(context.request)) return bad('درخواست نامعتبر است.', 403);
  if (!context.env?.DB) return bad('اتصال حساب کاربری به دیتابیس برقرار نیست.', 500);
  const customer = await requireCustomer(context);
  if (!customer) return bad('نیاز به ورود به حساب کاربری دارید.', 401);
  const body = await context.request.json().catch(() => null);
  const newPassword = String(body?.newPassword || '');
  const err = validatePassword(newPassword);
  if (err) return bad(err);
  const currentPassword = String(body?.currentPassword || '');
  if (customer.passwordHash) {
    if (!currentPassword || !customer.passwordSalt) return bad('رمز فعلی را وارد کنید.', 400);
    if (!(await verifyPassword(currentPassword, customer.passwordSalt, customer.passwordHash))) return bad('رمز فعلی نادرست است.', 401);
  }
  await ensureCustomerSchema(context.env.DB);
  const salt = await randomHex(16);
  const hash = await passwordHash(newPassword, salt);
  await context.env.DB.prepare('UPDATE customers SET password_hash=?,password_salt=?,updated_at=? WHERE id=?').bind(hash,salt,new Date().toISOString(),customer.id).run();
  return json({ ok:true, message:'رمز عبور با موفقیت ذخیره شد.' });
}
