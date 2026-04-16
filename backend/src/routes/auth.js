const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const router = express.Router();

const MFA_ROLES = ['director', 'accountant'];

// ─── Cookie config ────────────────────────────────────────────────────────────
const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, COOKIE_OPTS);
}
function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { ...COOKIE_OPTS, maxAge: 0 });
}

// ─── Rate limiters ─────────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Повторите через 15 минут.' },
});

const mfaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток MFA. Повторите через 5 минут.' },
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов сброса. Повторите через час.' },
});

// ─── Zod schemas ───────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email({ message: 'Некорректный email' }).max(255),
  password: z.string().min(1, { message: 'Пароль обязателен' }).max(128),
});

const mfaCodeSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().length(6).regex(/^\d+$/, { message: 'Код должен содержать 6 цифр' }),
});

const mfaTokenOnlySchema = z.object({
  mfaToken: z.string().min(1),
});

const resetRequestSchema = z.object({
  email: z.string().email({ message: 'Некорректный email' }).max(255),
});

const resetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string()
    .min(8, { message: 'Пароль должен содержать не менее 8 символов' })
    .max(128),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues?.[0]?.message || 'Ошибка валидации';
      return res.status(400).json({ error: msg });
    }
    req.body = result.data;
    next();
  };
}

// ─── Token helpers ─────────────────────────────────────────────────────────────
function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

async function generateRefreshToken(userId) {
  const token = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.run('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [userId, token, expiresAt]);
  return token;
}

function generateMfaTempToken(userId) {
  return jwt.sign({ userId, type: 'mfa_pending' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
}

// ─── Account lockout helpers ───────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function checkLocked(user) {
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
    return `Аккаунт временно заблокирован. Повторите через ${remaining} мин.`;
  }
  return null;
}

async function onLoginFailure(userId) {
  const user = await db.get('SELECT failed_attempts FROM users WHERE id = $1', [userId]);
  const attempts = (user?.failed_attempts || 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
    await db.run('UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3', [attempts, lockedUntil, userId]);
  } else {
    await db.run('UPDATE users SET failed_attempts = $1 WHERE id = $2', [attempts, userId]);
  }
}

async function onLoginSuccess(userId) {
  await db.run("UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1", [userId]);
}

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.get('SELECT * FROM users WHERE email = $1', [email]);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const lockMsg = checkLocked(user);
    if (lockMsg) {
      return res.status(429).json({ error: lockMsg });
    }

    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      await onLoginFailure(user.id);
      const updated = await db.get('SELECT failed_attempts, locked_until FROM users WHERE id = $1', [user.id]);
      const remaining = MAX_ATTEMPTS - updated.failed_attempts;
      if (remaining <= 0) {
        return res.status(429).json({ error: 'Аккаунт заблокирован на 15 мин. после превышения лимита попыток.' });
      }
      return res.status(401).json({ error: `Неверный email или пароль. Осталось попыток: ${remaining}` });
    }

    if (MFA_ROLES.includes(user.role)) {
      if (!user.mfa_enabled) {
        const mfaToken = generateMfaTempToken(user.id);
        return res.json({
          requiresMfaSetup: true,
          mfaToken,
          user: { id: user.id, name: user.name, role: user.role, email: user.email },
        });
      } else {
        const mfaToken = generateMfaTempToken(user.id);
        return res.json({
          requiresMfa: true,
          mfaToken,
          user: { id: user.id, name: user.name, role: user.role, email: user.email },
        });
      }
    }

    await onLoginSuccess(user.id);
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    logAudit(user.id, user.name, 'Вход в систему', 'Авторизация', null, req.ip);

    return res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position },
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/mfa/verify ─────────────────────────────────────────────────
router.post('/mfa/verify', mfaLimiter, validate(mfaCodeSchema), async (req, res) => {
  try {
    const { mfaToken, code } = req.body;

    let payload;
    try {
      payload = jwt.verify(mfaToken, process.env.JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({ error: 'Временный токен недействителен или истёк' });
    }

    if (payload.type !== 'mfa_pending') {
      return res.status(401).json({ error: 'Недопустимый тип токена' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      return res.status(400).json({ error: 'MFA не настроен' });
    }

    const lockMsg = checkLocked(user);
    if (lockMsg) return res.status(429).json({ error: lockMsg });

    const valid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      await onLoginFailure(user.id);
      return res.status(401).json({ error: 'Неверный код двухфакторной аутентификации' });
    }

    await onLoginSuccess(user.id);
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    logAudit(user.id, user.name, 'Вход в систему (с MFA)', 'Авторизация', null, req.ip);

    return res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position },
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/mfa/setup ──────────────────────────────────────────────────
router.post('/mfa/setup', mfaLimiter, validate(mfaTokenOnlySchema), async (req, res) => {
  try {
    const { mfaToken } = req.body;

    let payload;
    try {
      payload = jwt.verify(mfaToken, process.env.JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({ error: 'Токен недействителен или истёк' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const secret = speakeasy.generateSecret({
      name: `ContractPro (${user.email})`,
      issuer: 'ContractPro',
    });

    await db.run('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret.base32, user.id]);

    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) return res.status(500).json({ error: 'Ошибка генерации QR-кода' });
      res.json({ qrCode: dataUrl, secret: secret.base32 });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/mfa/enable ─────────────────────────────────────────────────
router.post('/mfa/enable', mfaLimiter, validate(mfaCodeSchema), async (req, res) => {
  try {
    const { mfaToken, code } = req.body;

    let payload;
    try {
      payload = jwt.verify(mfaToken, process.env.JWT_ACCESS_SECRET);
    } catch {
      return res.status(401).json({ error: 'Токен недействителен или истёк' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (!user || !user.mfa_secret) return res.status(400).json({ error: 'MFA не инициализирован' });

    const valid = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!valid) {
      return res.status(401).json({ error: 'Неверный код. Проверьте приложение аутентификатора.' });
    }

    await db.run('UPDATE users SET mfa_enabled = 1 WHERE id = $1', [user.id]);
    await onLoginSuccess(user.id);
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    setRefreshCookie(res, refreshToken);

    logAudit(user.id, user.name, 'MFA включён', 'Авторизация', null, req.ip);

    return res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position },
      accessToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token отсутствует' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token недействителен или истёк' });
    }

    const stored = await db.get('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);
    if (!stored) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token не найден' });
    }

    if (new Date(stored.expires_at) < new Date()) {
      await db.run('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token истёк' });
    }

    const user = await db.get('SELECT id, name, email, role, position, active FROM users WHERE id = $1', [payload.userId]);
    if (!user || !user.active) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Пользователь деактивирован' });
    }

    await db.run('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const newRefreshToken = await generateRefreshToken(user.id);
    setRefreshCookie(res, newRefreshToken);

    const newAccessToken = generateAccessToken(user.id);
    res.json({ accessToken: newAccessToken, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (refreshToken) {
      await db.run('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    clearRefreshCookie(res);
    logAudit(req.user.id, req.user.name, 'Выход из системы', 'Авторизация', null, req.ip);
    res.json({ message: 'Выход выполнен' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db.get('SELECT id, name, email, role, position, active, mfa_enabled, last_login FROM users WHERE id = $1', [req.user.id]);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/reset-password/request ────────────────────────────────────
router.post('/reset-password/request', resetLimiter, validate(resetRequestSchema), async (req, res) => {
  try {
    const { email } = req.body;

    const user = await db.get('SELECT id, name, active FROM users WHERE email = $1', [email]);

    if (!user || !user.active) {
      return res.json({ message: 'Если такой email существует, токен сброса будет создан.' });
    }

    await db.run('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await db.run('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, resetToken, expiresAt]);

    logAudit(user.id, user.name, 'Запрос сброса пароля', 'Авторизация', null, req.ip);

    return res.json({
      message: 'Токен сброса пароля создан.',
      resetToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/reset-password/confirm ────────────────────────────────────
router.post('/reset-password/confirm', resetLimiter, validate(resetConfirmSchema), async (req, res) => {
  try {
    const { token, password } = req.body;

    const record = await db.get('SELECT * FROM password_reset_tokens WHERE token = $1', [token]);
    if (!record || record.used) {
      return res.status(400).json({ error: 'Токен недействителен или уже использован' });
    }

    if (new Date(record.expires_at) < new Date()) {
      await db.run('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
      return res.status(400).json({ error: 'Срок действия токена истёк' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    await db.transaction(async (client) => {
      await client.run('UPDATE password_reset_tokens SET used = 1 WHERE token = $1', [token]);
      await client.run('UPDATE users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE id = $2', [passwordHash, record.user_id]);
      await client.run('DELETE FROM refresh_tokens WHERE user_id = $1', [record.user_id]);
    });

    const user = await db.get('SELECT id, name FROM users WHERE id = $1', [record.user_id]);
    logAudit(record.user_id, user?.name || '?', 'Пароль сброшен', 'Авторизация', null, req.ip);

    res.json({ message: 'Пароль успешно изменён. Войдите с новым паролем.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
