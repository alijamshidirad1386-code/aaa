-- PetraPet v3 — D1 performance/index maintenance.
-- Safe to run on an existing database. CREATE INDEX IF NOT EXISTS is non-destructive.

CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order, created_at);
CREATE INDEX IF NOT EXISTS idx_products_category_created ON products(category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_bestseller ON products(is_best_seller, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_new ON products(is_new, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_approved_created ON product_reviews(product_id, approved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_locked ON login_attempts(locked_until);

PRAGMA optimize;
