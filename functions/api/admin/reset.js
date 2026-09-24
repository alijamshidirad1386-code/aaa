import { bad, buildProductDetails, ensureExtendedSchema, getStore, json, requireAdmin, requireJson, upsertProductDetails } from '../_shared.js';

export async function onRequestPost(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const b = await requireJson(context.request);
  if (!b || !Array.isArray(b.products) || !Array.isArray(b.categories)) return bad('داده‌های پیش‌فرض ارسال نشده است.');

  const db = context.env.DB;
  await ensureExtendedSchema(db);
  const now = new Date().toISOString();
  const batch = [
    db.prepare('DELETE FROM product_reviews'),
    db.prepare('DELETE FROM product_details'),
    db.prepare('DELETE FROM products'),
    db.prepare('DELETE FROM categories')
  ];
  for (const c of b.categories) batch.push(db.prepare(`INSERT INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(c.id,c.name,c.slug||c.name,c.image||'',c.imageKey||'',c.icon||'fa-paw',c.color||'from-orange-500 to-amber-500',0,now,now));
  for (const p of b.products) batch.push(db.prepare(`INSERT INTO products(id,name,category_id,stock_status,original_price,discount_percent,final_price,is_featured,is_best_seller,is_new,image,image_key,short_desc,full_desc,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(p.id,p.name,p.categoryId,p.stockStatus||'in_stock',Number(p.originalPrice)||0,Number(p.discountPercent)||0,Number(p.finalPrice)||0,p.isFeatured?1:0,p.isBestSeller?1:0,p.isNew?1:0,p.image||'',p.imageKey||'',p.shortDesc||'',p.fullDesc||'',now,now));
  await db.batch(batch);
  for (const p of b.products) await upsertProductDetails(db, p.id, buildProductDetails(p.details || {}));
  return json({ ok: true, store: await getStore(db) });
}
