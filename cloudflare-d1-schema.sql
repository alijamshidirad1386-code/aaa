PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  image_key TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'fa-paw',
  color TEXT NOT NULL DEFAULT 'from-orange-500 to-amber-500',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  stock_status TEXT NOT NULL DEFAULT 'in_stock',
  original_price REAL NOT NULL DEFAULT 0,
  discount_percent REAL NOT NULL DEFAULT 0,
  final_price REAL NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_best_seller INTEGER NOT NULL DEFAULT 0,
  is_new INTEGER NOT NULL DEFAULT 0,
  image TEXT NOT NULL DEFAULT '',
  image_key TEXT NOT NULL DEFAULT '',
  short_desc TEXT NOT NULL DEFAULT '',
  full_desc TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_assets_created ON media_assets(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Initial admin account.
-- IMPORTANT: change the initial password immediately from the management panel.
-- Seed hash uses PBKDF2-HMAC-SHA256 with 100,000 iterations.
INSERT OR IGNORE INTO admins (username, password_hash, password_salt, created_at, updated_at)
VALUES (
  'admin',
  'a8884f6291a2fa0d1c8ed3a8b0a13e0d0a94b65e7fca77194d66b1b5cd853688',
  'f31a69ce8aec54ac4f6663adb05ead3e',
  datetime('now'), datetime('now')
);

-- Default store settings. The UI may overwrite these later.
INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES
('shopName', '"PetRaPet"', datetime('now')),
('phone', '"+98 996 049 4973"', datetime('now')),
('instagramUrl', '"https://www.instagram.com/petra_petclinic?stkn=MTVmM2Q4ZGhqNjloMw=="', datetime('now')),
('storeLocation', '"ایران"', datetime('now')) ,
('freeShippingThreshold', '2500000', datetime('now')),
('shippingCost', '120000', datetime('now')),
('shippingDispatchTime', '"۱ تا ۲ روز کاری"', datetime('now')),
('returnPolicy', '"در صورت ایراد یا مغایرت کالا، مطابق سیاست مرجوعی فروشگاه پیگیری می‌شود."', datetime('now')),
('authenticityPolicy', '"ارائه فاکتور و امکان ارائه اطلاعات اصالت و تاریخ انقضا بر اساس کالای موجود."', datetime('now')),
('aboutText', '"پت‌شاپ PetRaPet با هدف ارائه مرغوب‌ترین و اصیل‌ترین خوراک و ملزومات گربه‌ها ایجاد شده است. ما اهمیت عشق و مراقبتی که نسبت به گربه‌تان دارید را درک می‌کنیم؛ از این رو تمامی محصولات ما دست‌چین شده از معتبرترین برندهای جهانی با تضمین کیفیت، اصالت و انقضای معتبر می‌باشند."', datetime('now'));

INSERT OR IGNORE INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at) VALUES ('cat_dry_food','غذای خشک گربه','Dry Cat Food','https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=400&q=80&fm=webp','','fa-bowl-food','from-orange-500 to-amber-500',0,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at) VALUES ('cat_wet_food','کنسرو و پوچ لذیذ','Wet Food & Pouches','https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=400&q=80&fm=webp','','fa-fish','from-rose-500 to-pink-500',0,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at) VALUES ('cat_treats','تشویقی و بستنی گربه','Cat Treats & Pastes','https://images.unsplash.com/photo-1561948955-570b270e7c36?auto=format&fit=crop&w=400&q=80&fm=webp','','fa-cookie-bite','from-amber-400 to-orange-500',0,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at) VALUES ('cat_supplements','مکمل، خمیر مالت و ویتامین','Supplements & Care','https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=400&q=80&fm=webp','','fa-shield-heart','from-emerald-500 to-teal-600',0,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at) VALUES ('cat_litter','خاک بستر و ملزومات بهداشتی','Cat Litter & Hygiene','https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=400&q=80&fm=webp','','fa-box','from-blue-500 to-indigo-600',0,datetime('now'),datetime('now'));
INSERT OR IGNORE INTO categories(id,name,slug,image,image_key,icon,color,sort_order,created_at,updated_at) VALUES ('cat_toys','اسباب‌بازی و لوازم خواب','Toys & Accessories','https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=400&q=80&fm=webp','','fa-paw','from-purple-500 to-indigo-500',0,datetime('now'),datetime('now'));

CREATE TABLE IF NOT EXISTS product_details (
  product_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  weight TEXT NOT NULL DEFAULT '',
  volume TEXT NOT NULL DEFAULT '',
  flavor TEXT NOT NULL DEFAULT '',
  suitable_age TEXT NOT NULL DEFAULT '',
  goals TEXT NOT NULL DEFAULT '',
  ingredients TEXT NOT NULL DEFAULT '',
  nutrition_analysis TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  barcode TEXT NOT NULL DEFAULT '',
  expiry_date TEXT NOT NULL DEFAULT '',
  usage_method TEXT NOT NULL DEFAULT '',
  warranty TEXT NOT NULL DEFAULT '',
  storage TEXT NOT NULL DEFAULT '',
  authenticity TEXT NOT NULL DEFAULT '',
  actual_stock INTEGER,
  min_stock INTEGER,
  restock_time TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  more_images_json TEXT NOT NULL DEFAULT '[]',
  faq_json TEXT NOT NULL DEFAULT '[]',
  related_ids_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  consumable INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_details_brand ON product_details(brand);

CREATE TABLE IF NOT EXISTS product_reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  customer_name TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL DEFAULT 5,
  review_text TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product ON product_reviews(product_id, approved);

CREATE TABLE IF NOT EXISTS review_submission_log (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_submission_fingerprint ON review_submission_log(fingerprint, created_at);

CREATE TABLE IF NOT EXISTS foxshop_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_stories (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL DEFAULT '',
  cat_name TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL DEFAULT '',
  approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Customer accounts, OTP authentication, server-side favorites/cart and order-request history.
-- Authentication secrets (AUTH_PEPPER, RESEND_API_KEY, AUTH_EMAIL_FROM) are configured as Worker secrets.
-- phone columns below are legacy compatibility columns and are not used by customer auth.
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  password_salt TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL AND phone <> '';

CREATE TABLE IF NOT EXISTS customer_sessions (
  token_hash TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT '',
  last_seen_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_expiry ON customer_sessions(expires_at);

CREATE TABLE IF NOT EXISTS customer_otps (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  identifier_hash TEXT NOT NULL,
  channel TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_customer_otps_identifier ON customer_otps(identifier_hash, channel, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_otps_ip ON customer_otps(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS customer_auth_attempts (
  key_hash TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customer_wishlist (
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_wishlist_customer ON customer_wishlist(customer_id);

CREATE TABLE IF NOT EXISTS customer_cart (
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(customer_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_cart_customer ON customer_cart(customer_id);

CREATE TABLE IF NOT EXISTS customer_order_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_contact',
  total_amount REAL NOT NULL DEFAULT 0,
  items_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_customer_orders_customer ON customer_order_requests(customer_id, created_at);
