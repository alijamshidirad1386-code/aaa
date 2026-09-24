import { bad, createSession, getStore, json, passwordHash, randomHex, sha256Hex, sessionCookie, verifyPassword } from '../_shared.js';

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

// One-time migration for the original seed account. The old seed was created
// with 120,000 PBKDF2 iterations, which current Workers production rejects.
// Once this exact legacy record is migrated, this branch can never run again.
const LEGACY_SALT = 'f31a69ce8aec54ac4f6663adb05ead3e';
const LEGACY_HASH = '8b33a7c02624ca443f6950b64a1dd5e162ad611474c16959160383335550623f';
const LEGACY_DEFAULT_PASSWORD_SHA256 = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
const CURRENT_DEFAULT_HASH = 'a8884f6291a2fa0d1c8ed3a8b0a13e0d0a94b65e7fca77194d66b1b5cd853688';

async function ensureAuthTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    fail_count INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
}

export async function onRequestPost(context) {
  const db = context?.env?.DB;
  if (!db) return bad('اتصال Worker به D1 برقرار نیست. Binding با نام DB را بررسی کنید.', 500);

  const body = await context.request.json().catch(() => null);
  const username = String(body?.username ?? '').trim();
  const password = String(body?.password ?? '');
  if (!username || !password) return bad('نام کاربری و رمز عبور الزامی است.', 400);

  try {
    await ensureAuthTables(db);

    const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    const attemptKey = `${username}:${ip}`.slice(0, 180);
    const now = Date.now();

    const attempt = await db.prepare(
      'SELECT fail_count, locked_until FROM login_attempts WHERE key = ?'
    ).bind(attemptKey).first();

    if (attempt?.locked_until && Number(attempt.locked_until) > now) {
      const sec = Math.ceil((Number(attempt.locked_until) - now) / 1000);
      return bad(`تلاش‌های ورود موقتاً قفل شده است. ${sec} ثانیه دیگر دوباره امتحان کنید.`, 429);
    }

    const admin = await db.prepare(
      'SELECT id, username, password_hash, password_salt FROM admins WHERE username = ? LIMIT 1'
    ).bind(username).first();

    if (!admin) {
      const next = Number(attempt?.fail_count || 0) + 1;
      const lockedUntil = next >= MAX_FAILS ? now + LOCK_MS : 0;
      await db.prepare(`INSERT INTO login_attempts (key, fail_count, locked_until, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET fail_count=excluded.fail_count, locked_until=excluded.locked_until, updated_at=excluded.updated_at`)
        .bind(attemptKey, next, lockedUntil, new Date().toISOString()).run();
      return bad('نام کاربری یا رمز عبور اشتباه است.', 401);
    }

    let valid = false;

    // Automatic one-time migration of the original admin seed record.
    // The legacy hash itself cannot be recomputed on Workers because it used
    // 120,000 PBKDF2 iterations; Workers production rejects values >100,000.
    if (String(admin.password_hash).toLowerCase() === LEGACY_HASH && String(admin.password_salt).toLowerCase() === LEGACY_SALT) {
      const passwordDigest = await sha256Hex(password);
      if (passwordDigest === LEGACY_DEFAULT_PASSWORD_SHA256) {
        const migratedHash = await passwordHash(password, admin.password_salt);
        if (migratedHash !== CURRENT_DEFAULT_HASH) {
          console.error('PetRaPet legacy migration produced an unexpected hash.');
          return bad('AUTH_CRYPTO_ERROR', 500);
        }
        await db.prepare('UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?')
          .bind(migratedHash, new Date().toISOString(), admin.id).run();
        admin.password_hash = migratedHash;
        valid = true;
      }
    }

    if (!valid) {
      try {
        valid = await verifyPassword(password, admin.password_salt, admin.password_hash);
      } catch (hashError) {
        console.error('PetRaPet AUTH_CRYPTO_ERROR:', hashError);
        return bad('AUTH_CRYPTO_ERROR', 500);
      }
    }

    if (!valid) {
      const next = Number(attempt?.fail_count || 0) + 1;
      const lockedUntil = next >= MAX_FAILS ? now + LOCK_MS : 0;
      await db.prepare(`INSERT INTO login_attempts (key, fail_count, locked_until, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET fail_count=excluded.fail_count, locked_until=excluded.locked_until, updated_at=excluded.updated_at`)
        .bind(attemptKey, next, lockedUntil, new Date().toISOString()).run();
      return bad('نام کاربری یا رمز عبور اشتباه است.', 401);
    }

    await db.prepare('DELETE FROM login_attempts WHERE key = ?').bind(attemptKey).run();
    await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now).run();

    let session;
    try {
      session = await createSession(db, admin.id);
    } catch (sessionError) {
      console.error('PetRaPet session creation error:', sessionError);
      try {
        const raw = await randomHex(32);
        const tokenHash = await sha256Hex(raw);
        const expiresAt = now + (7 * 24 * 60 * 60 * 1000);
        await db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
          .bind(tokenHash, admin.id, expiresAt, new Date().toISOString()).run();
        session = { raw, expiresAt };
      } catch (repairError) {
        console.error('PetRaPet session repair error:', repairError);
        return bad('ورود انجام شد ولی ساخت نشست امن با D1 ناموفق بود. جدول sessions را بررسی کنید.', 500);
      }
    }

    let store = null;
    try { store = await getStore(db); }
    catch (storeError) { console.error('PetRaPet post-login store load error:', storeError); }

    return json({ ok: true, username: admin.username, ...(store ? { store } : {}) }, 200, {
      'Set-Cookie': sessionCookie(session.raw)
    });
  } catch (error) {
    console.error('PetRaPet login error:', error);
    return bad('خطای داخلی سرور هنگام ورود. D1 binding و جدول‌های admins/sessions را بررسی کنید.', 500);
  }
}
