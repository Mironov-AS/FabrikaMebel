const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../db');
const { authenticate, logAudit } = require('../middleware/auth');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const router = express.Router();

const MFA_ROLES = ['director', 'accountant'];

function generateAccessToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
}

function generateRefreshToken(userId) {
  const token = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(userId, token, expiresAt);
  return token;
}

function generateMfaTempToken(userId) {
  return jwt.sign({ userId, type: 'mfa_pending' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email и пароль обязательны' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const passwordValid = bcrypt.compareSync(password, user.password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  // Check if MFA is required for this role
  if (MFA_ROLES.includes(user.role)) {
    if (!user.mfa_enabled) {
      // MFA setup required
      const mfaToken = generateMfaTempToken(user.id);
      return res.json({
        requiresMfaSetup: true,
        mfaToken,
        user: { id: user.id, name: user.name, role: user.role, email: user.email },
      });
    } else {
      // MFA code required
      const mfaToken = generateMfaTempToken(user.id);
      return res.json({
        requiresMfa: true,
        mfaToken,
        user: { id: user.id, name: user.name, role: user.role, email: user.email },
      });
    }
  }

  // No MFA needed — issue tokens directly
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  logAudit(user.id, user.name, `Вход в систему`, 'Авторизация', null, req.ip);

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position },
    accessToken,
    refreshToken,
  });
});

// POST /api/auth/mfa/verify — verify TOTP code after login
router.post('/mfa/verify', (req, res) => {
  const { mfaToken, code } = req.body;
  if (!mfaToken || !code) {
    return res.status(400).json({ error: 'Токен и код обязательны' });
  }

  let payload;
  try {
    payload = jwt.verify(mfaToken, process.env.JWT_ACCESS_SECRET);
  } catch {
    return res.status(401).json({ error: 'Временный токен недействителен или истёк' });
  }

  if (payload.type !== 'mfa_pending') {
    return res.status(401).json({ error: 'Недопустимый тип токена' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!user || !user.mfa_enabled || !user.mfa_secret) {
    return res.status(400).json({ error: 'MFA не настроен' });
  }

  const valid = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: 'base32',
    token: code,
    window: 1,
  });

  if (!valid) {
    return res.status(401).json({ error: 'Неверный код двухфакторной аутентификации' });
  }

  db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  logAudit(user.id, user.name, 'Вход в систему (с MFA)', 'Авторизация', null, req.ip);

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position },
    accessToken,
    refreshToken,
  });
});

// GET /api/auth/mfa/setup — get QR code for MFA setup (requires mfaToken)
router.post('/mfa/setup', (req, res) => {
  const { mfaToken } = req.body;
  if (!mfaToken) return res.status(400).json({ error: 'Токен обязателен' });

  let payload;
  try {
    payload = jwt.verify(mfaToken, process.env.JWT_ACCESS_SECRET);
  } catch {
    return res.status(401).json({ error: 'Токен недействителен или истёк' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  // Generate new TOTP secret
  const secret = speakeasy.generateSecret({
    name: `ContractPro (${user.email})`,
    issuer: 'ContractPro',
  });

  // Store secret temporarily (will be confirmed during enable step)
  db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?').run(secret.base32, user.id);

  QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
    if (err) return res.status(500).json({ error: 'Ошибка генерации QR-кода' });
    res.json({ qrCode: dataUrl, secret: secret.base32 });
  });
});

// POST /api/auth/mfa/enable — enable MFA after confirming setup code
router.post('/mfa/enable', (req, res) => {
  const { mfaToken, code } = req.body;
  if (!mfaToken || !code) return res.status(400).json({ error: 'Токен и код обязательны' });

  let payload;
  try {
    payload = jwt.verify(mfaToken, process.env.JWT_ACCESS_SECRET);
  } catch {
    return res.status(401).json({ error: 'Токен недействителен или истёк' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
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

  db.prepare(`UPDATE users SET mfa_enabled = 1, last_login = datetime('now') WHERE id = ?`).run(user.id);
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  logAudit(user.id, user.name, 'MFA включён', 'Авторизация', null, req.ip);

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, position: user.position },
    accessToken,
    refreshToken,
  });
});

// POST /api/auth/refresh — refresh access token
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token обязателен' });

  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: 'Refresh token недействителен или истёк' });
  }

  const stored = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
  if (!stored) return res.status(401).json({ error: 'Refresh token не найден' });

  if (new Date(stored.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    return res.status(401).json({ error: 'Refresh token истёк' });
  }

  const user = db.prepare('SELECT id, name, email, role, position, active FROM users WHERE id = ?').get(payload.userId);
  if (!user || !user.active) return res.status(401).json({ error: 'Пользователь деактивирован' });

  const newAccessToken = generateAccessToken(user.id);
  res.json({ accessToken: newAccessToken, user });
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }
  logAudit(req.user.id, req.user.name, 'Выход из системы', 'Авторизация', null, req.ip);
  res.json({ message: 'Выход выполнен' });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, position, active, mfa_enabled, last_login FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

module.exports = router;
