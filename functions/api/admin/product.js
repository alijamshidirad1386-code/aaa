import { bad, buildProductDetails, getStore, json, requireAdmin, requireJson, cleanString, upsertProductDetails, ensureExtendedSchema } from '../_shared.js';

export async function onRequestPost(context) {
  try {
  const admin = await requireAdmin(context); if (!admin) return bad('نیاز به ورود مدیر دارید.', 401);
  const b = await requireJson(context.request);
  if (!b || typeof b !== 'object') return bad('داده محصول نامعتبر است.');
  const id = cleanString(b?.id, 100) || `prod_${crypto.randomUUID()}`;
  const name = cleanString(b?.name, 180);
  const categoryId = cleanString(b?.categoryId, 100);
  if (!name || !categoryId) return bad('نام محصول و دسته‌بندی الزامی است.');

  const originalPrice = Math.max(0, Number(b?.originalPrice) || 0);
  const discountPercent = Math.min(90, Math.max(0, Number(b?.discountPercent) || 0));
  const finalPrice = Number.isFinite(Number(b?.finalPrice))
    ? Math.max(0, Number(b.finalPrice))
    : Math.round(originalPrice * (1 - discountPercent / 100));
  const now = new Date().toISOString();
  const db = context.env.DB;
  await ensureExtendedSchema(db);

  await db.prepare(`INSERT INTO products
    (id,name,category_id,stock_status,original_price,discount_percent,final_price,is_featured,is_best_seller,is_new,image,image_key,short_desc,full_desc,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, name, categoryId, cleanString(b?.stockStatus, 30) || 'in_stock', originalPrice, discountPercent, finalPrice,
      Boolean(b?.isFeatured) ? 1 : 0, Boolean(b?.isBestSeller) ? 1 : 0, Boolean(b?.isNew) ? 1 : 0,
      cleanString(b?.image, 500000), cleanString(b?.imageKey, 200), cleanString(b?.shortDesc, 3000), cleanString(b?.fullDesc, 15000), now, now).run();

  await upsertProductDetails(db, id, buildProductDetails(b?.details || b));
  return json({ ok: true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_PRODUCT_CREATE_ERROR', error);
    return bad('ذخیره محصول انجام نشد: ' + String(error?.message || error), 500);
  }
}

