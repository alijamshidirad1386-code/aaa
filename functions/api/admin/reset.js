import {
  bad, buildProductDetails, ensureExtendedSchema, getStore, json, requireAdmin, requireJson,
  upsertProductDetails, isIntegerPrimaryKey, coerceDbValue, makeCompatibleTextId, extractDbError, getColumnKind
} from '../_shared.js';

export async function onRequestPost(context) {
  try {
    if (!(await requireAdmin(context))) return bad('نیاز به ورود مدیر دارید.', 401);
    const b = await requireJson(context.request);
    if (!b || !Array.isArray(b.products) || !Array.isArray(b.categories)) return bad('داده‌های پیش‌فرض ارسال نشده است.');

    const db = context.env.DB;
    await ensureExtendedSchema(db);
    const now = new Date().toISOString();
    const categoriesUseIntegerId = await isIntegerPrimaryKey(db, 'categories', 'id');
    const productsUseIntegerId = await isIntegerPrimaryKey(db, 'products', 'id');
    const productCategoryKind = await getColumnKind(db, 'products', 'category_id');
    const detailProductKind = await getColumnKind(db, 'product_details', 'product_id');
    const reviewProductKind = await getColumnKind(db, 'product_reviews', 'product_id');
    const categoryMap = new Map();
    const productMap = new Map();

    await db.batch([
      db.prepare('DELETE FROM product_reviews'),
      db.prepare('DELETE FROM product_details'),
      db.prepare('DELETE FROM products'),
      db.prepare('DELETE FROM categories')
    ]);

    for (const c of b.categories.slice(0, 200)) {
      const sourceId = String(c.id ?? '').trim();
      const imageKeyRaw = String(c.imageKey ?? '').trim();
      const imageKey = imageKeyRaw ? await coerceDbValue(db, 'categories', 'image_key', imageKeyRaw) : '';
      let dbId;
      if (categoriesUseIntegerId) {
        const result = await db.prepare(`INSERT INTO categories(name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?)`).bind(
          String(c.name ?? ''), String(c.slug || c.name || ''), String(c.image || ''), imageKey,
          String(c.icon || 'fa-paw'), String(c.color || 'from-orange-500 to-amber-500'), 0, now, now
        ).run();
        dbId = Number(result?.meta?.last_row_id || 0);
      } else {
        const numericCategoryRequired = productCategoryKind === 'integer-primary-key' || productCategoryKind === 'integer';
        if (sourceId && (!numericCategoryRequired || /^\d+$/.test(sourceId))) dbId = await coerceDbValue(db, 'categories', 'id', sourceId);
        else dbId = await makeCompatibleTextId(db, 'categories', 'id', 'cat_', [{ table: 'products', column: 'category_id' }]);
        await db.prepare(`INSERT INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(
          dbId, String(c.name ?? ''), String(c.slug || c.name || ''), String(c.image || ''), imageKey,
          String(c.icon || 'fa-paw'), String(c.color || 'from-orange-500 to-amber-500'), 0, now, now
        ).run();
      }
      if (sourceId) categoryMap.set(sourceId, dbId);
    }

    for (const p of b.products.slice(0, 500)) {
      const sourceId = String(p.id ?? '').trim();
      const mappedCategory = categoryMap.get(String(p.categoryId ?? '').trim()) ?? String(p.categoryId ?? '').trim();
      const categoryId = await coerceDbValue(db, 'products', 'category_id', mappedCategory);
      const imageKeyRaw = String(p.imageKey ?? '').trim();
      const imageKey = imageKeyRaw ? await coerceDbValue(db, 'products', 'image_key', imageKeyRaw) : '';
      const common = [
        String(p.name ?? ''), categoryId, String(p.stockStatus || 'in_stock'), Number(p.originalPrice) || 0,
        Number(p.discountPercent) || 0, Number(p.finalPrice) || 0, p.isFeatured ? 1 : 0, p.isBestSeller ? 1 : 0,
        p.isNew ? 1 : 0, String(p.image || ''), imageKey, String(p.shortDesc || ''), String(p.fullDesc || ''), now, now
      ];
      let dbId;
      if (productsUseIntegerId) {
        const result = await db.prepare(`INSERT INTO products(name,category_id,stock_status,original_price,discount_percent,final_price,is_featured,is_best_seller,is_new,image,image_key,short_desc,full_desc,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...common).run();
        dbId = Number(result?.meta?.last_row_id || 0);
      } else {
        const numericProductRequired = [detailProductKind, reviewProductKind].some(k => k === 'integer-primary-key' || k === 'integer');
        if (sourceId && (!numericProductRequired || /^\d+$/.test(sourceId))) dbId = await coerceDbValue(db, 'products', 'id', sourceId);
        else dbId = await makeCompatibleTextId(db, 'products', 'id', 'prod_', [
          { table: 'product_details', column: 'product_id' }, { table: 'product_reviews', column: 'product_id' },
          { table: 'review_submission_log', column: 'product_id' }, { table: 'customer_wishlist', column: 'product_id' }, { table: 'customer_cart', column: 'product_id' }
        ]);
        await db.prepare(`INSERT INTO products(id,name,category_id,stock_status,original_price,discount_percent,final_price,is_featured,is_best_seller,is_new,image,image_key,short_desc,full_desc,created_at,updated_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(dbId, ...common).run();
      }
      if (sourceId) productMap.set(sourceId, dbId);
    }

    for (const p of b.products.slice(0, 500)) {
      const sourceId = String(p.id ?? '').trim();
      const dbProductId = productMap.get(sourceId) ?? sourceId;
      await upsertProductDetails(db, dbProductId, buildProductDetails(p.details || {}));
    }
    return json({ ok: true, store: await getStore(db) });
  } catch (error) {
    const dbError = extractDbError(error);
    console.error('ADMIN_RESET_ERROR', error);
    return bad(`بازنشانی فروشگاه انجام نشد [${dbError.code || 'DB_ERROR'}]: ${dbError.message}`, 500, { errorCode: dbError.code || 'ADMIN_RESET_FAILED', errorDetails: { operation: 'admin.reset', database: dbError.message } });
  }
}
