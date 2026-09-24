const SESSION_DAYS = 7;
const SESSION_COOKIE = 'foxshop_session';
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SCHEME = `pbkdf2-sha256:${PBKDF2_ITERATIONS}`;
const PBKDF2_BYTES = 32;
let extendedSchemaReady = false;
let customerSchemaReady = false;
let reviewSchemaPromise = null;
let customerSchemaPromise = null;
let extendedSchemaPromise = null;

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra
    }
  });
}

export function bad(message, status = 400, extra = {}) {
  return json({ ok: false, error: message }, status, extra);
}

function bytesToHex(bytes) {
  let out = '';
  for (const b of bytes) out += Number(b).toString(16).padStart(2, '0');
  return out;
}

function hexToBytes(hex) {
  const clean = String(hex ?? '').trim();
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length === 0 || clean.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal salt');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function randomHex(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function passwordHash(password, saltHex) {
  const salt = hexToBytes(saltHex);
  const passBytes = new TextEncoder().encode(String(password ?? ''));
  const key = await globalThis.crypto.subtle.importKey('raw', passBytes, { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    PBKDF2_BYTES * 8
  );
  return bytesToHex(new Uint8Array(bits));
}

export async function verifyPassword(password, saltHex, expectedHash) {
  const expected = String(expectedHash ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) return false;
  const got = (await passwordHash(password, saltHex)).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(got) || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function getCookie(request, name) {
  const raw = request.headers.get('Cookie') || '';
  for (const chunk of raw.split(';')) {
    const [k, ...rest] = chunk.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function sessionCookie(value) {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function createSession(db, adminId) {
  const raw = await randomHex(32);
  const tokenHash = await sha256Hex(raw);
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  await db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(tokenHash, adminId, expiresAt, new Date().toISOString()).run();
  return { raw, expiresAt };
}

export async function requireAdmin(context) {
  const raw = getCookie(context.request, SESSION_COOKIE);
  if (!raw) return null;
  const hash = await sha256Hex(raw);
  return context.env.DB.prepare(`
    SELECT a.id, a.username
    FROM sessions s JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ? AND s.expires_at > ? LIMIT 1
  `).bind(hash, Date.now()).first();
}

export async function deleteSession(context) {
  const raw = getCookie(context.request, SESSION_COOKIE);
  if (!raw) return;
  const hash = await sha256Hex(raw);
  await context.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(hash).run();
}

export async function requireJson(request) {
  return request.json().catch(() => null);
}

export function cleanString(value, max = 100000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeJson(value, fallback) {
  try {
    const parsed = JSON.parse(String(value ?? ''));
    return parsed ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function normalizeDetails(row) {
  if (!row) return {
    slug: '', brand: '', weight: '', volume: '', flavor: '', suitableAge: '', goals: '', ingredients: '', nutritionAnalysis: '', country: '', barcode: '', expiryDate: '', usageMethod: '', warranty: '', storage: '', authenticity: '', actualStock: null, minStock: null, restockTime: '', rating: 0, reviewCount: 0, salesCount: 0, moreImages: [], faq: [], relatedIds: [], tags: [], consumable: false
  };
  return {
    slug: String(row.slug || ''),
    brand: String(row.brand || ''),
    weight: String(row.weight || ''),
    volume: String(row.volume || ''),
    flavor: String(row.flavor || ''),
    suitableAge: String(row.suitable_age || ''),
    goals: String(row.goals || ''),
    ingredients: String(row.ingredients || ''),
    nutritionAnalysis: String(row.nutrition_analysis || ''),
    country: String(row.country || ''),
    barcode: String(row.barcode || ''),
    expiryDate: String(row.expiry_date || ''),
    usageMethod: String(row.usage_method || ''),
    warranty: String(row.warranty || ''),
    storage: String(row.storage || ''),
    authenticity: String(row.authenticity || ''),
    actualStock: row.actual_stock == null ? null : Number(row.actual_stock),
    minStock: row.min_stock == null ? null : Number(row.min_stock),
    restockTime: String(row.restock_time || ''),
    rating: Number(row.rating) || 0,
    reviewCount: Number(row.review_count) || 0,
    salesCount: Number(row.sales_count) || 0,
    moreImages: safeJson(row.more_images_json, []),
    faq: safeJson(row.faq_json, []),
    relatedIds: safeJson(row.related_ids_json, []),
    tags: safeJson(row.tags_json, []),
    consumable: Boolean(Number(row.consumable || 0))
  };
}

export async function ensureExtendedSchema(db) {
  if (!db || extendedSchemaReady) return;

  // D1 can survive several deployments. Migrate legacy tables one statement at a time
  // so one incompatible old column never turns the admin review API into a generic 500.
  const exec = async (sql) => {
    try {
      await db.prepare(sql).run();
    } catch (error) {
      const message = String(error?.message || error || '');
      if (/already exists|duplicate column name/i.test(message)) return;
      throw error;
    }
  };

  await exec(`CREATE TABLE IF NOT EXISTS product_details (
    product_id TEXT PRIMARY KEY, slug TEXT NOT NULL DEFAULT '', brand TEXT NOT NULL DEFAULT '', weight TEXT NOT NULL DEFAULT '',
    volume TEXT NOT NULL DEFAULT '', flavor TEXT NOT NULL DEFAULT '', suitable_age TEXT NOT NULL DEFAULT '', goals TEXT NOT NULL DEFAULT '',
    ingredients TEXT NOT NULL DEFAULT '', nutrition_analysis TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', barcode TEXT NOT NULL DEFAULT '',
    expiry_date TEXT NOT NULL DEFAULT '', usage_method TEXT NOT NULL DEFAULT '', warranty TEXT NOT NULL DEFAULT '', storage TEXT NOT NULL DEFAULT '',
    authenticity TEXT NOT NULL DEFAULT '', actual_stock INTEGER, min_stock INTEGER, restock_time TEXT NOT NULL DEFAULT '',
    rating REAL NOT NULL DEFAULT 0, review_count INTEGER NOT NULL DEFAULT 0, sales_count INTEGER NOT NULL DEFAULT 0,
    more_images_json TEXT NOT NULL DEFAULT '[]', faq_json TEXT NOT NULL DEFAULT '[]', related_ids_json TEXT NOT NULL DEFAULT '[]',
    tags_json TEXT NOT NULL DEFAULT '[]', consumable INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT ''
  )`);
  const productDetailColumns = [
    ['slug', "TEXT NOT NULL DEFAULT ''"], ['brand', "TEXT NOT NULL DEFAULT ''"], ['weight', "TEXT NOT NULL DEFAULT ''"],
    ['volume', "TEXT NOT NULL DEFAULT ''"], ['flavor', "TEXT NOT NULL DEFAULT ''"], ['suitable_age', "TEXT NOT NULL DEFAULT ''"],
    ['goals', "TEXT NOT NULL DEFAULT ''"], ['ingredients', "TEXT NOT NULL DEFAULT ''"], ['nutrition_analysis', "TEXT NOT NULL DEFAULT ''"],
    ['country', "TEXT NOT NULL DEFAULT ''"], ['barcode', "TEXT NOT NULL DEFAULT ''"], ['expiry_date', "TEXT NOT NULL DEFAULT ''"],
    ['usage_method', "TEXT NOT NULL DEFAULT ''"], ['warranty', "TEXT NOT NULL DEFAULT ''"], ['storage', "TEXT NOT NULL DEFAULT ''"],
    ['authenticity', "TEXT NOT NULL DEFAULT ''"], ['actual_stock', 'INTEGER'], ['min_stock', 'INTEGER'],
    ['restock_time', "TEXT NOT NULL DEFAULT ''"], ['rating', 'REAL NOT NULL DEFAULT 0'], ['review_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['sales_count', 'INTEGER NOT NULL DEFAULT 0'], ['more_images_json', "TEXT NOT NULL DEFAULT '[]'"], ['faq_json', "TEXT NOT NULL DEFAULT '[]'"],
    ['related_ids_json', "TEXT NOT NULL DEFAULT '[]'"], ['tags_json', "TEXT NOT NULL DEFAULT '[]'"], ['consumable', 'INTEGER NOT NULL DEFAULT 0'],
    ['created_at', "TEXT NOT NULL DEFAULT ''"], ['updated_at', "TEXT NOT NULL DEFAULT ''"]
  ];
  for (const [name, type] of productDetailColumns) await exec(`ALTER TABLE product_details ADD COLUMN ${name} ${type}`);
  await exec('CREATE INDEX IF NOT EXISTS idx_product_details_brand ON product_details(brand)');
  await exec(`INSERT OR IGNORE INTO product_details(product_id, created_at, updated_at) SELECT id, datetime('now'), datetime('now') FROM products`);

  await exec(`CREATE TABLE IF NOT EXISTS product_reviews (
    id TEXT PRIMARY KEY, product_id TEXT NOT NULL, customer_name TEXT NOT NULL DEFAULT '', rating INTEGER NOT NULL DEFAULT 5,
    review_text TEXT NOT NULL DEFAULT '', photo_url TEXT NOT NULL DEFAULT '', approved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT ''
  )`);
  for (const [name, type] of [
    ['product_id', "TEXT NOT NULL DEFAULT ''"], ['customer_name', "TEXT NOT NULL DEFAULT ''"], ['rating', 'INTEGER NOT NULL DEFAULT 5'],
    ['review_text', "TEXT NOT NULL DEFAULT ''"], ['photo_url', "TEXT NOT NULL DEFAULT ''"], ['approved', 'INTEGER NOT NULL DEFAULT 0'],
    ['created_at', "TEXT NOT NULL DEFAULT ''"]
  ]) await exec(`ALTER TABLE product_reviews ADD COLUMN ${name} ${type}`);
  await exec('CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, approved)');

  await exec(`CREATE TABLE IF NOT EXISTS review_submission_log (
    id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL DEFAULT '', product_id TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL DEFAULT 0
  )`);
  for (const [name, type] of [['fingerprint', "TEXT NOT NULL DEFAULT ''"], ['product_id', "TEXT NOT NULL DEFAULT ''"], ['created_at', 'INTEGER NOT NULL DEFAULT 0']]) await exec(`ALTER TABLE review_submission_log ADD COLUMN ${name} ${type}`);
  await exec('CREATE INDEX IF NOT EXISTS idx_review_submission_fingerprint ON review_submission_log(fingerprint, created_at)');

  await exec(`CREATE TABLE IF NOT EXISTS customer_stories (
    id TEXT PRIMARY KEY, customer_name TEXT NOT NULL DEFAULT '', cat_name TEXT NOT NULL DEFAULT '', photo_url TEXT NOT NULL DEFAULT '',
    quote TEXT NOT NULL DEFAULT '', approved INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT ''
  )`);
  for (const [name, type] of [
    ['customer_name', "TEXT NOT NULL DEFAULT ''"], ['cat_name', "TEXT NOT NULL DEFAULT ''"], ['photo_url', "TEXT NOT NULL DEFAULT ''"],
    ['quote', "TEXT NOT NULL DEFAULT ''"], ['approved', 'INTEGER NOT NULL DEFAULT 0'], ['created_at', "TEXT NOT NULL DEFAULT ''"]
  ]) await exec(`ALTER TABLE customer_stories ADD COLUMN ${name} ${type}`);

  await exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '')`);
  await exec(`CREATE TABLE IF NOT EXISTS foxshop_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT '')`);
  await exec(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES ('storeLocation','"ایران"',datetime('now'))`);
  await exec(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES ('freeShippingThreshold','3500000',datetime('now'))`);
  await exec(`UPDATE settings SET value='3500000', updated_at=datetime('now') WHERE key='freeShippingThreshold' AND value IN ('2000000','\"2000000\"','2500000','\"2500000\"','3000000','\"3000000\"')`);
  await exec(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES ('shippingCost','120000',datetime('now'))`);
  await exec(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES ('shippingDispatchTime','"۱ تا ۲ روز کاری"',datetime('now'))`);
  await exec(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES ('returnPolicy','"شرایط مرجوعی طبق سیاست ثبت‌شده فروشگاه و با بررسی وضعیت کالا انجام می‌شود."',datetime('now'))`);
  await exec(`INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES ('authenticityPolicy','"اطلاعات اصالت و مستندات هر محصول فقط در صورت ثبت و قابل ارائه بودن نمایش داده می‌شود."',datetime('now'))`);
  await exec(`INSERT OR IGNORE INTO foxshop_migrations(id, applied_at) VALUES('remove_telegram_setting', datetime('now'))`);
  await exec(`DELETE FROM settings WHERE key='telegramUser'`);
  extendedSchemaReady = true;
}


/**
 * Minimal, isolated D1 migration for the customer-review feature.
 * It intentionally does not depend on product_details/settings/customer_stories,
 * so an older database can still serve /api/admin/review and /api/review safely.
 */
export async function ensureReviewSchema(db) {
  if (!db) throw new Error('D1 binding is missing');
  if (reviewSchemaPromise) return reviewSchemaPromise;
  reviewSchemaPromise = (async () => {
    // Avoid running ALTER TABLE on every review. The original PetRaPet schema already
    // contains these columns; only create missing tables/indexes when necessary.
    const hasTable = async (name) => {
      const row = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").bind(name).first();
      return !!row;
    };
    if (!(await hasTable('product_reviews'))) {
      await db.prepare(`CREATE TABLE IF NOT EXISTS product_reviews (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL DEFAULT 5,
        review_text TEXT NOT NULL DEFAULT '',
        photo_url TEXT NOT NULL DEFAULT '',
        approved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT ''
      )`).run();
    }
    if (!(await hasTable('review_submission_log'))) {
      await db.prepare(`CREATE TABLE IF NOT EXISTS review_submission_log (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL DEFAULT '',
        product_id TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT 0
      )`).run();
    }
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, approved)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_review_submission_fingerprint ON review_submission_log(fingerprint, created_at)').run();
  })().finally(() => { reviewSchemaPromise = null; });
  return reviewSchemaPromise;
}

export async function getStore(db) {
  await ensureExtendedSchema(db);
  const [cats, prods, details, reviews, stories, rows] = await Promise.all([
    db.prepare('SELECT id,name,slug,image,image_key AS imageKey,icon,color,sort_order AS sortOrder FROM categories ORDER BY sort_order ASC, created_at ASC').all(),
    db.prepare('SELECT id,name,category_id AS categoryId,stock_status AS stockStatus,original_price AS originalPrice,discount_percent AS discountPercent,final_price AS finalPrice,is_featured AS isFeatured,is_best_seller AS isBestSeller,is_new AS isNew,image,image_key AS imageKey,short_desc AS shortDesc,full_desc AS fullDesc FROM products ORDER BY created_at DESC').all(),
    db.prepare('SELECT * FROM product_details').all(),
    db.prepare('SELECT id,product_id AS productId,customer_name AS customerName,rating,review_text AS reviewText,photo_url AS photoUrl,created_at AS createdAt FROM product_reviews WHERE approved=1 ORDER BY created_at DESC').all(),
    db.prepare('SELECT id,customer_name AS customerName,cat_name AS catName,photo_url AS photoUrl,quote,created_at AS createdAt FROM customer_stories WHERE approved=1 ORDER BY created_at DESC').all(),
    db.prepare('SELECT key,value FROM settings').all()
  ]);

  const detailsByProduct = {};
  for (const row of details?.results || []) detailsByProduct[row.product_id] = normalizeDetails(row);
  const reviewsByProduct = {};
  for (const row of reviews?.results || []) (reviewsByProduct[row.productId] ||= []).push(row);

  const settings = {};
  for (const r of rows?.results || []) {
    const parsed = safeJson(r.value, null);
    settings[r.key] = parsed === null ? r.value : parsed;
  }

  const products = (prods?.results || []).map(p => ({
    ...p,
    isFeatured: Boolean(p.isFeatured),
    isBestSeller: Boolean(p.isBestSeller),
    isNew: Boolean(p.isNew),
    details: detailsByProduct[p.id] || normalizeDetails(null),
    reviews: reviewsByProduct[p.id] || []
  }));

  return {
    categories: cats?.results || [],
    products,
    settings,
    customerStories: stories?.results || []
  };
}

export function cleanJsonArray(value, maxItems = 40, maxItemLength = 2000) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map(item => {
    if (typeof item === 'string') return cleanString(item, maxItemLength);
    if (!item || typeof item !== 'object') return null;
    const copy = {};
    for (const [k, v] of Object.entries(item).slice(0, 16)) {
      if (typeof v === 'string') copy[k] = cleanString(v, maxItemLength);
      else if (typeof v === 'number' || typeof v === 'boolean') copy[k] = v;
    }
    return copy;
  }).filter(Boolean);
}

export function buildProductDetails(body = {}) {
  const list = cleanJsonArray;
  const actualStock = body.actualStock === '' || body.actualStock == null ? null : Math.max(0, Math.floor(Number(body.actualStock) || 0));
  const minStock = body.minStock === '' || body.minStock == null ? null : Math.max(0, Math.floor(Number(body.minStock) || 0));
  return {
    slug: cleanString(body.slug, 160),
    brand: cleanString(body.brand, 160),
    weight: cleanString(body.weight, 100),
    volume: cleanString(body.volume, 100),
    flavor: cleanString(body.flavor, 180),
    suitableAge: cleanString(body.suitableAge, 260),
    goals: cleanString(body.goals, 400),
    ingredients: cleanString(body.ingredients, 12000),
    nutritionAnalysis: cleanString(body.nutritionAnalysis, 10000),
    country: cleanString(body.country, 120),
    barcode: cleanString(body.barcode, 80),
    expiryDate: cleanString(body.expiryDate, 80),
    usageMethod: cleanString(body.usageMethod, 3000),
    warranty: cleanString(body.warranty, 500),
    storage: cleanString(body.storage, 1200),
    authenticity: cleanString(body.authenticity, 1000),
    actualStock: actualStock,
    minStock: minStock,
    restockTime: cleanString(body.restockTime, 160),
    rating: Math.min(5, Math.max(0, Number(body.rating) || 0)),
    reviewCount: Math.max(0, Math.floor(Number(body.reviewCount) || 0)),
    salesCount: Math.max(0, Math.floor(Number(body.salesCount) || 0)),
    moreImages: list(body.moreImages, 8, 500000),
    faq: list(body.faq, 12, 1000),
    relatedIds: list(body.relatedIds, 12, 120),
    tags: list(body.tags, 30, 80),
    consumable: Boolean(body.consumable)
  };
}

export async function upsertProductDetails(db, productId, details) {
  await ensureExtendedSchema(db);
  const now = new Date().toISOString();
  return db.prepare(`INSERT INTO product_details(
    product_id,slug,brand,weight,volume,flavor,suitable_age,goals,ingredients,nutrition_analysis,country,barcode,expiry_date,
    usage_method,warranty,storage,authenticity,actual_stock,min_stock,restock_time,rating,review_count,sales_count,more_images_json,
    faq_json,related_ids_json,tags_json,consumable,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(product_id) DO UPDATE SET
    slug=excluded.slug,brand=excluded.brand,weight=excluded.weight,volume=excluded.volume,flavor=excluded.flavor,
    suitable_age=excluded.suitable_age,goals=excluded.goals,ingredients=excluded.ingredients,nutrition_analysis=excluded.nutrition_analysis,
    country=excluded.country,barcode=excluded.barcode,expiry_date=excluded.expiry_date,usage_method=excluded.usage_method,warranty=excluded.warranty,
    storage=excluded.storage,authenticity=excluded.authenticity,actual_stock=excluded.actual_stock,min_stock=excluded.min_stock,
    restock_time=excluded.restock_time,rating=excluded.rating,review_count=excluded.review_count,sales_count=excluded.sales_count,
    more_images_json=excluded.more_images_json,faq_json=excluded.faq_json,related_ids_json=excluded.related_ids_json,tags_json=excluded.tags_json,
    consumable=excluded.consumable,updated_at=excluded.updated_at`)
    .bind(
      productId, details.slug, details.brand, details.weight, details.volume, details.flavor, details.suitableAge, details.goals,
      details.ingredients, details.nutritionAnalysis, details.country, details.barcode, details.expiryDate, details.usageMethod,
      details.warranty, details.storage, details.authenticity, details.actualStock, details.minStock, details.restockTime, details.rating,
      details.reviewCount, details.salesCount, JSON.stringify(details.moreImages), JSON.stringify(details.faq), JSON.stringify(details.relatedIds),
      JSON.stringify(details.tags), details.consumable ? 1 : 0, now, now
    ).run();
}


const CUSTOMER_SESSION_DAYS = 30;
const CUSTOMER_SESSION_COOKIE = '__Host-foxshop_customer_session';

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return '';
  return email;
}

export function normalizeCustomerIdentifier(value) {
  const email = normalizeEmail(value);
  return email ? { type: 'email', value: email } : null;
}

export function validatePassword(value) {
  const p = String(value ?? '');
  if (p.length < 8 || p.length > 128) return 'رمز عبور باید بین ۸ تا ۱۲۸ کاراکتر باشد.';
  if (/^\s+$/.test(p)) return 'رمز عبور معتبر نیست.';
  return '';
}

export function customerSessionCookie(value) {
  return `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(value)}; Max-Age=${CUSTOMER_SESSION_DAYS * 24 * 60 * 60}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearCustomerSessionCookie() {
  return `${CUSTOMER_SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export async function ensureCustomerSchema(db) {
  if (!db) throw new Error('D1 binding is missing');
  if (customerSchemaReady) return;
  const exec = async (sql) => {
    try { await db.prepare(sql).run(); }
    catch (error) {
      const message = String(error?.message || error || '');
      if (/already exists|duplicate column name/i.test(message)) return;
      throw error;
    }
  };

  await exec(`CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT,
    password_salt TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`);
  for (const [name, type] of [
    ['email', 'TEXT'], ['display_name', "TEXT NOT NULL DEFAULT ''"],
    ['password_hash', 'TEXT'], ['password_salt', 'TEXT'], ['email_verified', 'INTEGER NOT NULL DEFAULT 0'],
    ['created_at', "TEXT NOT NULL DEFAULT ''"], ['updated_at', "TEXT NOT NULL DEFAULT ''"]
  ]) await exec(`ALTER TABLE customers ADD COLUMN ${name} ${type}`);
  await exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL AND email <> \'\'');

  await exec(`CREATE TABLE IF NOT EXISTS customer_sessions (
    token_hash TEXT PRIMARY KEY, customer_id TEXT NOT NULL, expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT '', last_seen_at INTEGER NOT NULL DEFAULT 0
  )`);
  await exec('CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id)');
  await exec('CREATE INDEX IF NOT EXISTS idx_customer_sessions_expiry ON customer_sessions(expires_at)');

  await exec(`CREATE TABLE IF NOT EXISTS customer_otps (
    id TEXT PRIMARY KEY, customer_id TEXT, identifier_hash TEXT NOT NULL, channel TEXT NOT NULL,
    code_hash TEXT NOT NULL, code_salt TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    consumed INTEGER NOT NULL DEFAULT 0, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
    ip_hash TEXT NOT NULL DEFAULT ''
  )`);
  await exec('CREATE INDEX IF NOT EXISTS idx_customer_otps_identifier ON customer_otps(identifier_hash, channel, created_at)');
  await exec('CREATE INDEX IF NOT EXISTS idx_customer_otps_ip ON customer_otps(ip_hash, created_at)');

  await exec(`CREATE TABLE IF NOT EXISTS customer_auth_attempts (
    key_hash TEXT PRIMARY KEY, fail_count INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
  )`);

  await exec(`CREATE TABLE IF NOT EXISTS customer_wishlist (
    customer_id TEXT NOT NULL, product_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(customer_id, product_id)
  )`);
  await exec('CREATE INDEX IF NOT EXISTS idx_customer_wishlist_customer ON customer_wishlist(customer_id)');

  await exec(`CREATE TABLE IF NOT EXISTS customer_cart (
    customer_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT '', PRIMARY KEY(customer_id, product_id)
  )`);
  await exec('CREATE INDEX IF NOT EXISTS idx_customer_cart_customer ON customer_cart(customer_id)');

  await exec(`CREATE TABLE IF NOT EXISTS customer_order_requests (
    id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_contact', total_amount REAL NOT NULL DEFAULT 0,
    items_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT ''
  )`);
  await exec('CREATE INDEX IF NOT EXISTS idx_customer_orders_customer ON customer_order_requests(customer_id, created_at)');
  customerSchemaReady = true;
}


export async function authPepper(env) {
  // Optional hardening secret. Customer auth remains functional without it because
  // passwords and OTPs are individually salted; setting AUTH_PEPPER adds another
  // server-side secret layer without making the whole login system depend on one
  // dashboard setting.
  const pepper = String(env?.AUTH_PEPPER || '').trim();
  return pepper.length >= 24 ? pepper : '';
}

export async function authHash(value, pepper = '') {
  return sha256Hex(`${String(pepper)}:${String(value)}`);
}

export async function createCustomerSession(db, customerId) {
  const raw = await randomHex(32);
  const tokenHash = await sha256Hex(raw);
  const expiresAt = Date.now() + CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db.prepare('INSERT INTO customer_sessions(token_hash,customer_id,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?)')
    .bind(tokenHash, customerId, expiresAt, new Date().toISOString(), Date.now()).run();
  return { raw, expiresAt };
}

export async function requireCustomer(context) {
  const raw = getCookie(context.request, CUSTOMER_SESSION_COOKIE);
  if (!raw || !context?.env?.DB) return null;
  await ensureCustomerSchema(context.env.DB);
  const hash = await sha256Hex(raw);
  const customer = await context.env.DB.prepare(`
    SELECT c.id,c.email,c.display_name AS displayName,c.password_hash AS passwordHash,
           c.password_salt AS passwordSalt,c.email_verified AS emailVerified
    FROM customer_sessions s JOIN customers c ON c.id=s.customer_id
    WHERE s.token_hash=? AND s.expires_at>? LIMIT 1
  `).bind(hash, Date.now()).first();
  if (customer) {
    context.env.DB.prepare('UPDATE customer_sessions SET last_seen_at=? WHERE token_hash=?').bind(Date.now(), hash).run().catch(() => {});
  }
  return customer || null;
}

export async function deleteCustomerSession(context) {
  const raw = getCookie(context.request, CUSTOMER_SESSION_COOKIE);
  if (!raw || !context?.env?.DB) return;
  await ensureCustomerSchema(context.env.DB);
  const hash = await sha256Hex(raw);
  await context.env.DB.prepare('DELETE FROM customer_sessions WHERE token_hash=?').bind(hash).run();
}

export function sameOriginRequest(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch (_) { return false; }
}

export async function sendCustomerOtp({ env, identifier, code }) {
  if (identifier?.type !== 'email') throw new Error('EMAIL_ONLY_AUTH');
  const value = String(identifier.value || '');
  const apiKey = String(env?.RESEND_API_KEY || '').trim();
  const from = String(env?.AUTH_EMAIL_FROM || '').trim();
  if (!apiKey || !from) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');

  const safeEmail = String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]));
  const safeCode = String(code).replace(/\D/g, '').slice(0, 6);
  const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#fff7ed;font-family:Tahoma,Arial,sans-serif;color:#111827">
  <div style="max-width:620px;margin:0 auto;padding:28px 16px">
    <div style="background:#ffffff;border:1px solid #fed7aa;border-radius:28px;overflow:hidden;box-shadow:0 18px 55px rgba(87,44,17,.10)">
      <div style="padding:28px 28px 20px;background:linear-gradient(135deg,#111827,#2b1738);color:#fff">
        <div style="font-size:13px;font-weight:800;color:#fdba74;letter-spacing:.2px">PETRAPET • PETRAPET</div>
        <div style="font-size:30px;font-weight:900;margin-top:8px">خوش اومدی به PetRaPet 🐾</div>
        <div style="font-size:14px;line-height:2;margin-top:8px;color:rgba(255,255,255,.72)">برای ورود یا ساخت حساب کاربری، کد زیر را در سایت وارد کن.</div>
      </div>
      <div style="padding:30px 28px">
        <div style="font-size:13px;color:#64748b">کد تأیید ورود شما</div>
        <div style="margin:14px 0 20px;padding:20px 14px;border-radius:20px;background:#fff7ed;border:1px dashed #fdba74;text-align:center">
          <div style="font-size:38px;line-height:1;font-weight:900;letter-spacing:10px;color:#ea580c;direction:ltr">${safeCode}</div>
        </div>
        <p style="font-size:13px;line-height:2;color:#334155;margin:0">این کد تا <strong>۱۰ دقیقه</strong> معتبر است و فقط یک‌بار قابل استفاده است.</p>
        <p style="font-size:12px;line-height:2;color:#94a3b8;margin:12px 0 0">این ایمیل برای ${safeEmail} ارسال شده است. اگر این درخواست متعلق به شما نیست، کافی است این پیام را نادیده بگیرید.</p>
      </div>
      <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">PetRaPet • حساب کاربری امن و سریع</div>
    </div>
  </div>
</body>
</html>`;

  const text = `خوش اومدی به PetRaPet 🐾\n\nکد تأیید ورود شما: ${safeCode}\n\nاین کد تا ۱۰ دقیقه معتبر است و فقط یک‌بار قابل استفاده است.\nاگر این درخواست متعلق به شما نیست، این پیام را نادیده بگیر.`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [value],
      subject: '🐾 خوش اومدی به PetRaPet | کد ورود شما',
      html,
      text
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('PetRaPet email provider error:', res.status, detail.slice(0, 500));
    throw new Error('EMAIL_PROVIDER_FAILED');
  }
  return true;
}

