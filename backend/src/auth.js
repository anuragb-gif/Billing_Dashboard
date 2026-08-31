const crypto = require('crypto');
require('dotenv').config();

const COOKIE_NAME = 'snowman_auth';
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

// Stable secret so logins survive a server restart. Falls back to a random
// per-boot value (with a warning) if the operator hasn't set one.
let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] SESSION_SECRET not set in .env - using a random one; everyone will be logged out on restart.');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function sign(expiresAt) {
  const payload = String(expiresAt);
  const mac = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

function verify(token) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  if (!safeEqual(mac, expected)) return false;
  return Number(payload) > Date.now();
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function isAuthed(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verify(cookies[COOKIE_NAME]);
}

function setSessionCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${sign(Date.now() + MAX_AGE_MS)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

// POST /api/login  { password }
function login(req, res) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return res.status(500).json({ ok: false, error: 'DASHBOARD_PASSWORD is not set on the server.' });
  }
  const given = (req.body && req.body.password) || '';
  if (!safeEqual(given, expected)) {
    return res.status(401).json({ ok: false, error: 'Incorrect password.' });
  }
  setSessionCookie(res);
  res.json({ ok: true });
}

// POST /api/logout
function logout(req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
}

// Gate for everything under /api that isn't explicitly public.
function requireAuth(req, res, next) {
  if (isAuthed(req)) return next();
  res.status(401).json({ ok: false, error: 'Not logged in.' });
}

module.exports = { login, logout, requireAuth, isAuthed, COOKIE_NAME };
