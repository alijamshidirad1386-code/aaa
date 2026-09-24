import { bad, getStore, json, requireAdmin, requireJson, cleanString } from '../../_shared.js';
export async function onRequestDelete(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const id = context.params.id;
  const used = await context.env.DB.prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ?').bind(id).first();
  if (Number(used?.c || 0) > 0) return bad('این دسته‌بندی هنوز محصول دارد و قابل حذف نیست.', 409);
  await context.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
  return json({ ok:true, store: await getStore(context.env.DB) });
}
export async function onRequestPut(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const b = await requireJson(context.request); const id = context.params.id;
  if (!id) return bad('شناسه دسته‌بندی نامعتبر است.');
  await context.env.DB.prepare(`UPDATE categories SET name=?, slug=?, image=?, image_key=?, icon=?, color=?, updated_at=? WHERE id=?`)
    .bind(cleanString(b?.name,150),cleanString(b?.slug,160),cleanString(b?.image,500000),cleanString(b?.imageKey,200),cleanString(b?.icon,80)||'fa-paw',cleanString(b?.color,120)||'from-orange-500 to-amber-500',new Date().toISOString(),id).run();
  return json({ ok:true, store: await getStore(context.env.DB) });
}
