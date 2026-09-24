import { json, requireAdmin, getStore } from '../_shared.js';
export async function onRequestGet(context) {
  const admin = await requireAdmin(context);
  if (!admin) return json({ ok: false, authenticated: false }, 401);
  return json({ ok: true, authenticated: true, username: admin.username, store: await getStore(context.env.DB) });
}
