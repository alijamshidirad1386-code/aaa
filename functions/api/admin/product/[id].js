import { bad, buildProductDetails, getStore, json, requireAdmin, requireJson, cleanString, upsertProductDetails, ensureExtendedSchema } from '../../_shared.js';

export async function onRequestPut(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const id = cleanString(context.params.id, 100);
  if (!id) return bad('شناسه محصول نامعتبر است.');

  const b = await requireJson(context.request);
  const name = cleanString(b?.name, 180);
  const categoryId = cleanString(b?.categoryId, 100);
  if (!name || !categoryId) return bad('نام محصول و دسته‌بندی الزامی است.');

  const originalPrice = Math.max(0, Number(b?.originalPrice) || 0);
  const discountPercent = Math.min(90, Math.max(0, Number(b?.discountPercent) || 0));
  const finalPrice = Number.isFinite(Number(b?.finalPrice))
    ? Math.max(0, Number(b.finalPrice))
    : Math.round(originalPrice * (1 - discountPercent / 100));
  const db = context.env.DB;
  await ensureExtendedSchema(db);

  const result = await db.prepare(`UPDATE products SET
    name=?, category_id=?, stock_status=?, original_price=?, discount_percent=?, final_price=?,
    is_featured=?, is_best_seller=?, is_new=?, image=?, image_key=?, short_desc=?, full_desc=?, updated_at=?
    WHERE id=?`)
    .bind(
      name,
      categoryId,
      cleanString(b?.stockStatus, 30) || 'in_stock',
      originalPrice,
      discountPercent,
      finalPrice,
      Boolean(b?.isFeatured) ? 1 : 0,
      Boolean(b?.isBestSeller) ? 1 : 0,
      Boolean(b?.isNew) ? 1 : 0,
      cleanString(b?.image, 500000),
      cleanString(b?.imageKey, 200),
      cleanString(b?.shortDesc, 3000),
      cleanString(b?.fullDesc, 15000),
      new Date().toISOString(),
      id
    ).run();

  if (!result.meta?.changes) return bad('محصول موردنظر پیدا نشد.', 404);
  await upsertProductDetails(db, id, buildProductDetails(b?.details || b));
  return json({ ok: true, store: await getStore(db) });
}

export async function onRequestDelete(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const id = cleanString(context.params.id, 100);
  if (!id) return bad('شناسه محصول نامعتبر است.');
  await ensureExtendedSchema(context.env.DB);
  await context.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return json({ ok: true, store: await getStore(context.env.DB) });
}
