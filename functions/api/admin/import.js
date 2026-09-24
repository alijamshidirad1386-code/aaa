import { bad, buildProductDetails, ensureExtendedSchema, getStore, json, requireAdmin, requireJson, cleanString, upsertProductDetails } from '../_shared.js';

export async function onRequestPost(context) {
  if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
  const b = await requireJson(context.request);
  if (!b || !Array.isArray(b.products) || !Array.isArray(b.categories)) return bad('ساختار پشتیبان نامعتبر است.');

  const db = context.env.DB;
  await ensureExtendedSchema(db);
  const now = new Date().toISOString();
  const batch = [
    db.prepare('DELETE FROM customer_stories'),
    db.prepare('DELETE FROM product_reviews'),
    db.prepare('DELETE FROM product_details'),
    db.prepare('DELETE FROM products'),
    db.prepare('DELETE FROM categories')
  ];

  for (const c of b.categories) batch.push(db.prepare(`INSERT INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
      cleanString(c.id,100), cleanString(c.name,150), cleanString(c.slug,160), cleanString(c.image,500000), cleanString(c.imageKey,200),
      cleanString(c.icon,80) || 'fa-paw', cleanString(c.color,120) || 'from-orange-500 to-amber-500', 0, now, now
  ));

  for (const p of b.products) {
    batch.push(db.prepare(`INSERT INTO products(id,name,category_id,stock_status,original_price,discount_percent,final_price,is_featured,is_best_seller,is_new,image,image_key,short_desc,full_desc,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      cleanString(p.id,100), cleanString(p.name,180), cleanString(p.categoryId,100), cleanString(p.stockStatus,30) || 'in_stock',
      Number(p.originalPrice) || 0, Number(p.discountPercent) || 0, Number(p.finalPrice) || 0,
      Boolean(p.isFeatured) ? 1 : 0, Boolean(p.isBestSeller) ? 1 : 0, Boolean(p.isNew) ? 1 : 0,
      cleanString(p.image,500000), cleanString(p.imageKey,200), cleanString(p.shortDesc,3000), cleanString(p.fullDesc,15000), now, now
    ));
    // Details are inserted after the main product rows so FK constraints remain intact.
  }

  if (b.settings && typeof b.settings === 'object') {
    for (const [key, value] of Object.entries(b.settings)) {
      if (key === 'telegramUser') continue;
      batch.push(db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at')
        .bind(cleanString(key,120), JSON.stringify(value), now));
    }
  }

  await db.batch(batch);

  if (Array.isArray(b.customerStories) && b.customerStories.length) {
    const storyBatch = b.customerStories.slice(0,100).map(story => db.prepare(`INSERT INTO customer_stories(id,customer_name,cat_name,photo_url,quote,approved,created_at) VALUES(?,?,?,?,?,?,?)`).bind(cleanString(story.id,120)||`story_${crypto.randomUUID()}`, cleanString(story.customerName,120), cleanString(story.catName,120), cleanString(story.photoUrl,500000), cleanString(story.quote,1500), story.approved === false ? 0 : 1, story.createdAt || now));
    if (storyBatch.length) await db.batch(storyBatch);
  }

  for (const p of b.products) {
    await upsertProductDetails(db, cleanString(p.id,100), buildProductDetails(p.details || {}));
  }

  return json({ ok: true, store: await getStore(db) });
}
