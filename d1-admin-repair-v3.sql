-- PetraPet v3 — repair the admin authentication tables.
-- Paste this into the Cloudflare D1 SQL Console and execute it as ONE script.
-- It preserves the existing admins table and resets only disposable session/lock tables.


DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS login_attempts;

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked ON login_attempts(locked_until);

INSERT OR IGNORE INTO admins (username,password_hash,password_salt,created_at,updated_at)
VALUES (
  'admin',
  'a8884f6291a2fa0d1c8ed3a8b0a13e0d0a94b65e7fca77194d66b1b5cd853688',
  'f31a69ce8aec54ac4f6663adb05ead3e',
  datetime('now'),
  datetime('now')
);

