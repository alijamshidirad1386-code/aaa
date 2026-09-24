import { bad, getStore, json, requireAdmin, requireJson, verifyPassword } from '../_shared.js';
export async function onRequestPut(context) {
  const admin=await requireAdmin(context); if(!admin) return bad('نیاز به ورود مدیر دارید.',401);
  const b=await requireJson(context.request); const nextUsername=String(b?.username||'').trim(); const currentPassword=String(b?.currentPassword||'');
  if(!/^[A-Za-z0-9_.-]{3,40}$/.test(nextUsername)) return bad('نام کاربری نامعتبر است.');
  const row=await context.env.DB.prepare('SELECT password_hash,password_salt FROM admins WHERE id=?').bind(admin.id).first();
  if(!row || !(await verifyPassword(currentPassword,row.password_salt,row.password_hash))) return bad('رمز عبور فعلی اشتباه است.',401);
  try { await context.env.DB.prepare('UPDATE admins SET username=?,updated_at=? WHERE id=?').bind(nextUsername,new Date().toISOString(),admin.id).run(); }
  catch { return bad('این نام کاربری قبلاً استفاده شده است.',409); }
  return json({ok:true,username:nextUsername,store:await getStore(context.env.DB)});
}
