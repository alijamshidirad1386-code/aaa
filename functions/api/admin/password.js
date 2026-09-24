import { bad, createSession, getStore, json, requireAdmin, requireJson, passwordHash, randomHex, sessionCookie, verifyPassword } from '../_shared.js';
export async function onRequestPut(context) {
  const admin=await requireAdmin(context); if(!admin) return bad('نیاز به ورود مدیر دارید.',401);
  const b=await requireJson(context.request); const currentPassword=String(b?.currentPassword||''); const nextPassword=String(b?.newPassword||'');
  if(nextPassword.length<8) return bad('رمز جدید باید حداقل ۸ کاراکتر باشد.');
  const row=await context.env.DB.prepare('SELECT password_hash,password_salt FROM admins WHERE id=?').bind(admin.id).first();
  if(!row || !(await verifyPassword(currentPassword,row.password_salt,row.password_hash))) return bad('رمز عبور فعلی اشتباه است.',401);
  const salt=await randomHex(16); const hash=await passwordHash(nextPassword,salt); const now=new Date().toISOString();
  await context.env.DB.prepare('UPDATE admins SET password_hash=?,password_salt=?,updated_at=? WHERE id=?').bind(hash,salt,now,admin.id).run();
  await context.env.DB.prepare('DELETE FROM sessions WHERE admin_id=?').bind(admin.id).run();
  const session=await createSession(context.env.DB,admin.id);
  return json({ok:true,username:admin.username,store:await getStore(context.env.DB)},200,{'Set-Cookie':sessionCookie(session.raw)});
}
