import { bad, cleanString, ensureExtendedSchema, getStore, json, requireAdmin } from '../../_shared.js';
export async function onRequestDelete(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const id = cleanString(context.params.id, 120);
  if (!id) return bad('شناسه تجربه نامعتبر است.');
  await ensureExtendedSchema(context.env.DB);
  await context.env.DB.prepare('DELETE FROM customer_stories WHERE id=?').bind(id).run();
  return json({ ok: true, store: await getStore(context.env.DB) });
}
