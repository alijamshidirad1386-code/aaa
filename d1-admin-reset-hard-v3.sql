-- PetraPet v3 — HARD reset of admin authentication.
-- Use ONLY when the existing admins table itself is corrupted or its schema is unknown.
-- WARNING: this permanently removes every admin account and creates the default account again.
-- New credentials: username=admin, password=admin123

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS admins;

CREATE TABLE admins (
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

CREATE INDEX idx_sessions_admin ON sessions(admin_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE login_attempts (
  key TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_login_attempts_locked ON login_attempts(locked_until);

INSERT INTO admins (username,password_hash,password_salt,created_at,updated_at)
VALUES (
  'admin',
  'a8884f6291a2fa0d1c8ed3a8b0a13e0d0a94b65e7fca77194d66b1b5cd853688',
  'f31a69ce8aec54ac4f6663adb05ead3e',
  datetime('now'),
  datetime('now')
);

PRAGMA optimize;
