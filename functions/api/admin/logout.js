import { clearSessionCookie, deleteSession, json } from '../_shared.js';
export async function onRequestPost(context) {
  await deleteSession(context);
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
