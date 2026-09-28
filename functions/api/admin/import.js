import {
  bad,
  buildProductDetails,
  ensureExtendedSchema,
  getStore,
  json,
  requireAdmin,
  requireJson,
  cleanString,
  upsertProductDetails,
  isIntegerPrimaryKey,
  coerceDbValue,
  extractDbError,
  makeCompatibleTextId,
  getColumnKind,
  makeUniqueSlug
} from '../_shared.js';

export async function onRequestPost(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const b = await requireJson(context.request);
    if (!b || !Array.isArray(b.products) || !Array.isArray(b.categories)) return bad('ساختار پشتیبان نامعتبر است.');

    const db = context.env.DB;
    await ensureExtendedSchema(db);
    const now = new Date().toISOString();
    const categoryIds = new Map();
    const productIds = new Map();
    const categoriesUseIntegerId = await isIntegerPrimaryKey(db, 'categories', 'id');
    const productsUseIntegerId = await isIntegerPrimaryKey(db, 'products', 'id');
    const productCategoryKind = await getColumnKind(db, 'products', 'category_id');
    const detailProductKind = await getColumnKind(db, 'product_details', 'product_id');
    const reviewProductKind = await getColumnKind(db, 'product_reviews', 'product_id');

    // Rebuild catalog tables inside one transaction. We intentionally insert
    // sequentially here so that legacy INTEGER PRIMARY KEY databases can be
    // mapped to the IDs expected by the backup instead of hitting SQLITE_MISMATCH.
    await db.batch([
      db.prepare('DELETE FROM customer_stories'),
      db.prepare('DELETE FROM product_reviews'),
      db.prepare('DELETE FROM product_details'),
      db.prepare('DELETE FROM products'),
      db.prepare('DELETE FROM categories')
    ]);

    for (const c of b.categories.slice(0, 200)) {
      const sourceId = cleanString(c.id, 100);
      const categoryName = cleanString(c.name, 150);
      const categorySlug = await makeUniqueSlug(db, 'categories', cleanString(c.slug, 160) || categoryName, { fallback: 'category' });
      let dbId;
      if (categoriesUseIntegerId) {
        const imageKeyRaw = cleanString(c.imageKey, 200);
        const imageKeyDb = imageKeyRaw ? await coerceDbValue(db, 'categories', 'image_key', imageKeyRaw) : '';
        const result = await db.prepare(`INSERT INTO categories(name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?)`).bind(
          categoryName, categorySlug, cleanString(c.image,500000), imageKeyDb,
          cleanString(c.icon,80) || 'fa-paw', cleanString(c.color,120) || 'from-orange-500 to-amber-500', 0, now, now
        ).run();
        dbId = Number(result?.meta?.last_row_id || 0);
      } else {
        const numericCategoryRequired = productCategoryKind === 'integer-primary-key' || productCategoryKind === 'integer';
        if (sourceId && (!numericCategoryRequired || /^\d+$/.test(sourceId))) {
          dbId = await coerceDbValue(db, 'categories', 'id', sourceId);
        } else {
          dbId = await makeCompatibleTextId(db, 'categories', 'id', 'cat_', [{ table: 'products', column: 'category_id' }]);
        }
        const imageKeyRaw = cleanString(c.imageKey, 200);
        const imageKeyDb = imageKeyRaw ? await coerceDbValue(db, 'categories', 'image_key', imageKeyRaw) : '';
        await db.prepare(`INSERT INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
          dbId, categoryName, categorySlug, cleanString(c.image,500000), imageKeyDb,
          cleanString(c.icon,80) || 'fa-paw', cleanString(c.color,120) || 'from-orange-500 to-amber-500', 0, now, now
        ).run();
      }
      if (sourceId) categoryIds.set(sourceId, dbId);
    }

    for (const p of b.products.slice(0, 500)) {
      const sourceId = cleanString(p.id, 100);
      const productName = cleanString(p.name, 180);
      const productSlug = await makeUniqueSlug(db, 'products', cleanString(p.slug, 160) || cleanString(p?.details?.slug, 160) || productName, { fallback: 'product' });
      const sourceCategoryId = cleanString(p.categoryId, 100);
      const mappedCategory = categoryIds.get(sourceCategoryId) ?? sourceCategoryId;
      const categoryDbValue = await coerceDbValue(db, 'products', 'category_id', mappedCategory);
      const imageKeyRaw = cleanString(p.imageKey, 200);
      const imageKeyDb = imageKeyRaw ? await coerceDbValue(db, 'products', 'image_key', imageKeyRaw) : '';
      const common = [
        productName, productSlug, categoryDbValue, cleanString(p.stockStatus,30) || 'in_stock',
        Number(p.originalPrice) || 0, Number(p.discountPercent) || 0, Number(p.finalPrice) || 0,
        Boolean(p.isFeatured) ? 1 : 0, Boolean(p.isBestSeller) ? 1 : 0, Boolean(p.isNew) ? 1 : 0,
        cleanString(p.image,500000), imageKeyDb, cleanString(p.shortDesc,3000), cleanString(p.fullDesc,15000), now, now
      ];
      let dbId;
      if (productsUseIntegerId) {
        const result = await db.prepare(`INSERT INTO products(name,slug,category_id,stock_status,original_price,discount_percent,final_price,is_featured,is_best_seller,is_new,image,image_key,short_desc,full_desc,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...common).run();
        dbId = Number(result?.meta?.last_row_id || 0);
      } else {
        const numericProductRequired = [detailProductKind, reviewProductKind].some(k => k === 'integer-primary-key' || k === 'integer');
        if (sourceId && (!numericProductRequired || /^\d+$/.test(sourceId))) {
          dbId = await coerceDbValue(db, 'products', 'id', sourceId);
        } else {
          dbId = await makeCompatibleTextId(db, 'products', 'id', 'prod_', [
            { table: 'product_details', column: 'product_id' }, { table: 'product_reviews', column: 'product_id' },
            { table: 'review_submission_log', column: 'product_id' }, { table: 'customer_wishlist', column: 'product_id' }, { table: 'customer_cart', column: 'product_id' }
          ]);
        }
        await db.prepare(`INSERT INTO products(id,name,slug,category_id,stock_status,original_price,discount_percent,final_price,is_featured,is_best_seller,is_new,image,image_key,short_desc,full_desc,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(dbId, ...common).run();
      }
      if (sourceId) productIds.set(sourceId, dbId);
    }

    if (b.settings && typeof b.settings === 'object') {
      for (const [key, value] of Object.entries(b.settings)) {
        if (key === 'telegramUser') continue;
        await db.prepare('INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at')
          .bind(cleanString(key,120), JSON.stringify(value), now).run();
      }
    }

    if (Array.isArray(b.customerStories) && b.customerStories.length) {
      for (const story of b.customerStories.slice(0,100)) {
        await db.prepare(`INSERT INTO customer_stories(id,customer_name,cat_name,photo_url,quote,approved,created_at) VALUES(?,?,?,?,?,?,?)`)
          .bind(cleanString(story.id,120)||`story_${crypto.randomUUID()}`, cleanString(story.customerName,120), cleanString(story.catName,120), cleanString(story.photoUrl,500000), cleanString(story.quote,1500), story.approved === false ? 0 : 1, story.createdAt || now).run();
      }
    }

    for (const p of b.products.slice(0, 500)) {
      const sourceId = cleanString(p.id,100);
      const dbProductId = productIds.get(sourceId) ?? sourceId;
      await upsertProductDetails(db, dbProductId, buildProductDetails({ ...(p.details || {}), slug: (p.slug || p?.details?.slug || p.name || '') }));
    }

    return json({ ok: true, store: await getStore(db) });
  } catch (error) {
    console.error('ADMIN_IMPORT_ERROR', error);
    const dbError = extractDbError(error);
    return bad(`بازیابی پشتیبان انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, {
      errorCode: dbError.code || 'ADMIN_IMPORT_FAILED',
      errorDetails: { operation: 'admin.import', database: dbError.message }
    });
  }
}
