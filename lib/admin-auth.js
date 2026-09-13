import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const cookieName = 'safemode_admin';
const lifetimeSeconds = 8 * 60 * 60;

function secret() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 20) throw Object.assign(new Error('ยังไม่ได้ตั้งค่ารหัสผู้ดูแล'), { status: 503 });
  return createHmac('sha256', process.env.DOWNLOAD_SECRET || password).update('safemode-shop-admin-session-v1').digest();
}

function equal(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}

function signature(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function adminConfigured() {
  return typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length >= 20 && !process.env.ADMIN_PASSWORD.includes('REPLACE');
}

export function correctPassword(candidate) {
  if (!adminConfigured() || typeof candidate !== 'string') return false;
  return equal(createHash('sha256').update(candidate).digest(), createHash('sha256').update(process.env.ADMIN_PASSWORD).digest());
}

export function sessionCookie(request) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + lifetimeSeconds, nonce: randomBytes(12).toString('base64url') })).toString('base64url');
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName}=${payload}.${signature(payload)}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${lifetimeSeconds}${secure}`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secure}`;
}

export function isAdmin(request) {
  if (!adminConfigured()) return false;
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`));
  if (!cookie) return false;
  const token = cookie.slice(cookieName.length + 1);
  if (token.length > 300) return false;
  const separator = token.indexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  if (!equal(signature(payload), token.slice(separator + 1))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isInteger(parsed.exp) && parsed.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
