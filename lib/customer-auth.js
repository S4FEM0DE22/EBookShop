import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { cleanEmail, validateEmail } from './http.js';
import { isLocalDemo } from './store.js';

const scrypt = promisify(scryptCallback);
const cookieName = 'safemode_customer';
const lifetime = 7 * 24 * 60 * 60;
const localFile = path.join(process.cwd(), '.data', 'customers.json');
const localSecret = randomBytes(32);
let localQueue = Promise.resolve();

function key() {
  if (isLocalDemo()) return localSecret;
  if (!process.env.DOWNLOAD_SECRET || process.env.DOWNLOAD_SECRET.length < 32) {
    throw Object.assign(new Error('ยังไม่ได้ตั้งค่าคีย์เซสชัน'), { status: 503 });
  }
  return createHmac('sha256', process.env.DOWNLOAD_SECRET).update('safemode-customer-session-v1').digest();
}

function signature(value) { return createHmac('sha256', key()).update(value).digest('base64url'); }
function equal(a, b) {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function cookie(request, value, age) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${age}${secure}`;
}
export function sessionCookie(request, user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: cleanEmail(user.email), name: user.name || '', exp: Math.floor(Date.now() / 1000) + lifetime })).toString('base64url');
  return cookie(request, `${payload}.${signature(payload)}`, lifetime);
}
export function clearSessionCookie(request) { return cookie(request, '', 0); }
export function customer(request) {
  const part = request.headers.get('cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`));
  if (!part) return null;
  const token = part.slice(cookieName.length + 1);
  if (token.length > 1400) return null;
  const [payload, mac, extra] = token.split('.');
  if (!payload || !mac || extra || !equal(signature(payload), mac)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.id !== 'string' || !validateEmail(data.email) || !Number.isInteger(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null;
    return { id: data.id, email: cleanEmail(data.email), name: typeof data.name === 'string' ? data.name : '' };
  } catch { return null; }
}
export function requireCustomer(request) {
  const user = customer(request);
  if (!user) throw Object.assign(new Error('กรุณาเข้าสู่ระบบก่อนสั่งซื้อ'), { status: 401 });
  return user;
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw Object.assign(new Error('คำขอไม่ได้มาจากเว็บไซต์นี้'), { status: 403 });
}

async function localRead() {
  try { return JSON.parse(await readFile(localFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function localRegister(name, email, password) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  const work = localQueue.then(async () => {
    const users = await localRead();
    if (users.some(user => user.email === email)) throw Object.assign(new Error('อีเมลนี้มีบัญชีแล้ว'), { status: 409 });
    const user = { id: randomBytes(16).toString('hex'), name, email, salt, hash };
    users.push(user);
    await mkdir(path.dirname(localFile), { recursive: true });
    await writeFile(localFile, JSON.stringify(users, null, 2));
    return { id: user.id, name, email };
  });
  localQueue = work.catch(() => {});
  return work;
}
async function localLogin(email, password) {
  const user = (await localRead()).find(item => item.email === email);
  if (!user) throw Object.assign(new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'), { status: 401 });
  const hash = await scrypt(password, user.salt, 64);
  if (!equal(hash, Buffer.from(user.hash, 'hex'))) throw Object.assign(new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'), { status: 401 });
  return { id: user.id, name: user.name, email };
}
async function supabaseAuth(endpoint, payload) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const apikey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !apikey || url.includes('YOUR_PROJECT') || apikey.includes('REPLACE_ME')) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Supabase'), { status: 503 });
  const headers = { apikey, 'Content-Type': 'application/json' };
  if (!apikey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${apikey}`;
  const response = await fetch(`${url}/auth/v1/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : response.status;
    const message = response.status === 429 ? 'ลองใหม่อีกครั้งในภายหลัง' : response.status >= 500 ? 'ระบบบัญชีขัดข้อง' : (data.msg || data.message || 'ไม่สามารถเข้าสู่ระบบได้');
    throw Object.assign(new Error(message), { status });
  }
  return data;
}
export async function register(name, email, password) {
  if (isLocalDemo()) return { user: await localRegister(name, email, password), confirmationRequired: false };
  const result = await supabaseAuth('signup', { email, password, data: { full_name: name } });
  const user = result.user || result;
  if (!user?.id || !user?.email) throw Object.assign(new Error('สมัครสมาชิกไม่สำเร็จ'), { status: 503 });
  return { user: { id: user.id, email: cleanEmail(user.email), name }, confirmationRequired: !result.access_token };
}
export async function login(email, password) {
  if (isLocalDemo()) return localLogin(email, password);
  const result = await supabaseAuth('token?grant_type=password', { email, password });
  if (!result.access_token || !result.user?.id || !result.user?.email) throw Object.assign(new Error('เข้าสู่ระบบไม่สำเร็จ'), { status: 401 });
  return { id: result.user.id, email: cleanEmail(result.user.email), name: result.user.user_metadata?.full_name || '' };
}
