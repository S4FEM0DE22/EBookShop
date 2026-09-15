import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { cleanEmail, validateEmail } from './http.js';
import { getCustomerProfileById, getCustomerProfileByUsername, isLocalDemo, listCustomerProfilesDb, setCustomerUsername } from './store.js';

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
export function normalizeUserNames(source = {}) {
  const firstName = (typeof source.first_name === 'string' ? source.first_name : (typeof source.firstName === 'string' ? source.firstName : '')).trim();
  const lastName = (typeof source.last_name === 'string' ? source.last_name : (typeof source.lastName === 'string' ? source.lastName : '')).trim();
  let fullName = (typeof source.full_name === 'string' ? source.full_name : (typeof source.name === 'string' ? source.name : '')).trim();

  let resolvedFirst = firstName;
  let resolvedLast = lastName;

  if (!resolvedFirst && !resolvedLast && fullName && fullName !== source.username) {
    const parts = fullName.split(/\s+/);
    resolvedFirst = parts[0] || '';
    resolvedLast = parts.slice(1).join(' ') || '';
  }

  const combinedName = [resolvedFirst, resolvedLast].filter(Boolean).join(' ');
  const finalName = combinedName || fullName || source.username || '';

  return {
    firstName: resolvedFirst,
    lastName: resolvedLast,
    first_name: resolvedFirst,
    last_name: resolvedLast,
    fullName: finalName,
    name: finalName
  };
}

export function getUserDisplayName(user, fallback = '') {
  if (!user) return fallback;
  const names = normalizeUserNames(user);
  return names.fullName || user.username || fallback;
}

export function sessionCookie(request, user) {
  const names = normalizeUserNames(user);
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: cleanEmail(user.email), name: names.name, firstName: names.firstName, lastName: names.lastName, username: user.username || null, version: user.version, exp: Math.floor(Date.now() / 1000) + lifetime })).toString('base64url');
  return cookie(request, `${payload}.${signature(payload)}`, lifetime);
}
export function clearSessionCookie(request) { return cookie(request, '', 0); }
export async function customer(request) {
  const part = request.headers.get('cookie')?.split(';').map(item => item.trim()).find(item => item.startsWith(`${cookieName}=`));
  if (!part) return null;
  const token = part.slice(cookieName.length + 1);
  if (token.length > 1400) return null;
  const [payload, mac, extra] = token.split('.');
  if (!payload || !mac || extra || !equal(signature(payload), mac)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.id !== 'string' || !validateEmail(data.email) || !Number.isInteger(data.version) || !Number.isInteger(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null;
    const profile = isLocalDemo() ? (await localRead()).find(user => user.id === data.id) : await getCustomerProfileById(data.id);
    if (!profile || (profile.session_version || 1) !== data.version || cleanEmail(profile.email) !== cleanEmail(data.email)) return null;
    const names = normalizeUserNames({ ...data, username: profile.username });
    return { id: data.id, email: cleanEmail(data.email), name: names.name, firstName: names.firstName, lastName: names.lastName, username: profile.username || null, version: data.version };
  } catch { return null; }
}
export async function requireCustomer(request) {
  const user = await customer(request);
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
async function localRegister(username, email, password, firstName = '', lastName = '') {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  const cleanFirst = typeof firstName === 'string' ? firstName.trim() : '';
  const cleanLast = typeof lastName === 'string' ? lastName.trim() : '';
  const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ') || username;
  const work = localQueue.then(async () => {
    const users = await localRead();
    if (users.some(user => user.email === email)) throw Object.assign(new Error('อีเมลนี้มีบัญชีแล้ว'), { status: 409 });
    if (users.some(user => user.username === username)) throw Object.assign(new Error('Username นี้มีคนใช้แล้ว'), { status: 409 });
    const user = { id: randomBytes(16).toString('hex'), username, name: fullName, first_name: cleanFirst, last_name: cleanLast, email, salt, hash, session_version: 1 };
    users.push(user);
    await mkdir(path.dirname(localFile), { recursive: true });
    await writeFile(localFile, JSON.stringify(users, null, 2));
    return { id: user.id, username, name: fullName, firstName: cleanFirst, lastName: cleanLast, email, version: 1 };
  });
  localQueue = work.catch(() => {});
  return work;
}
async function localLogin(identifier, password) {
  const user = (await localRead()).find(item => item.email === identifier || item.username === identifier);
  if (!user) throw Object.assign(new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'), { status: 401 });
  const hash = await scrypt(password, user.salt, 64);
  if (!equal(hash, Buffer.from(user.hash, 'hex'))) throw Object.assign(new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'), { status: 401 });
  const names = normalizeUserNames(user);
  return { id: user.id, username: user.username || null, name: names.name, firstName: names.firstName, lastName: names.lastName, email: user.email, version: user.session_version || 1 };
}
async function supabaseAuth(endpoint, payload, method = 'POST', bearer) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const apikey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !apikey || url.includes('YOUR_PROJECT') || apikey.includes('REPLACE_ME')) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Supabase'), { status: 503 });
  const headers = { apikey, 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  else if (!apikey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${apikey}`;
  const response = await fetch(`${url}/auth/v1/${endpoint}`, { method, headers, body: JSON.stringify(payload), cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : response.status;
    const detail = data.msg || data.message || '';
    const message = /email address not authorized/i.test(detail) ? 'ระบบยังไม่สามารถส่งอีเมลไปยังที่อยู่นี้ได้ กรุณาติดต่อผู้ดูแลร้าน' : response.status === 429 ? 'ลองใหม่อีกครั้งในภายหลัง' : response.status >= 500 ? 'ระบบบัญชีขัดข้อง' : (detail || 'ไม่สามารถเข้าสู่ระบบได้');
    throw Object.assign(new Error(message), { status });
  }
  return data;
}
export async function register(username, email, password, firstName = '', lastName = '') {
  const cleanFirst = typeof firstName === 'string' ? firstName.trim() : '';
  const cleanLast = typeof lastName === 'string' ? lastName.trim() : '';
  const fullName = [cleanFirst, cleanLast].filter(Boolean).join(' ') || username;
  if (isLocalDemo()) return { user: await localRegister(username, email, password, cleanFirst, cleanLast), confirmationRequired: false };
  if (await getCustomerProfileByUsername(username)) throw Object.assign(new Error('Username นี้มีคนใช้แล้ว'), { status: 409 });
  const result = await supabaseAuth('signup', { email, password, data: { username, first_name: cleanFirst, last_name: cleanLast, full_name: fullName } });
  const user = result.user || result;
  if (!user?.id || !user?.email) throw Object.assign(new Error('สมัครสมาชิกไม่สำเร็จ'), { status: 503 });
  const profile = await getCustomerProfileById(user.id);
  return { user: { id: user.id, email: cleanEmail(user.email), username: profile?.username || username, name: fullName, firstName: cleanFirst, lastName: cleanLast, version: profile?.session_version || 1 }, confirmationRequired: !result.access_token };
}
export async function login(identifier, password) {
  if (isLocalDemo()) return localLogin(identifier, password);
  const email = identifier.includes('@') ? identifier : (await getCustomerProfileByUsername(identifier))?.email;
  if (!email) throw Object.assign(new Error('Username/อีเมลหรือรหัสผ่านไม่ถูกต้อง'), { status: 401 });
  const result = await supabaseAuth('token?grant_type=password', { email, password });
  if (!result.access_token || !result.user?.id || !result.user?.email) throw Object.assign(new Error('เข้าสู่ระบบไม่สำเร็จ'), { status: 401 });
  const profile = await getCustomerProfileById(result.user.id);
  if (!profile) throw Object.assign(new Error('ไม่พบโปรไฟล์ลูกค้า'), { status: 503 });
  const meta = result.user.user_metadata || {};
  const names = normalizeUserNames({ ...meta, username: profile.username });
  return { id: result.user.id, email: cleanEmail(result.user.email), username: profile.username, name: names.name || profile.username || '', firstName: names.firstName, lastName: names.lastName, version: profile.session_version };
}

export async function updateCustomerProfile(user, firstName, lastName) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (isLocalDemo()) {
    const work = localQueue.then(async () => {
      const users = await localRead();
      const found = users.find(item => item.id === user.id);
      if (!found) throw Object.assign(new Error('ไม่พบบัญชีผู้ใช้'), { status: 404 });
      found.name = fullName || found.username || '';
      found.first_name = firstName;
      found.last_name = lastName;
      await writeFile(localFile, JSON.stringify(users, null, 2));
      return { ...user, name: found.name, firstName, lastName };
    });
    localQueue = work.catch(() => {});
    return work;
  }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const apikey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !apikey) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Supabase'), { status: 503 });
  const getRes = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    headers: { apikey, Authorization: `Bearer ${apikey}` }
  });
  if (!getRes.ok) throw Object.assign(new Error('ไม่พบบัญชีผู้ใช้'), { status: 404 });
  const userData = await getRes.json();
  const updateRes = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: { apikey, Authorization: `Bearer ${apikey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_metadata: {
        ...(userData.user_metadata || {}),
        first_name: firstName,
        last_name: lastName,
        full_name: fullName
      }
    })
  });
  if (!updateRes.ok) throw Object.assign(new Error('ไม่สามารถบันทึกข้อมูลได้'), { status: 500 });
  return { ...user, name: fullName, firstName, lastName };
}

export async function claimUsername(user, username) {
  if (isLocalDemo()) {
    const work = localQueue.then(async () => {
      const users = await localRead();
      const found = users.find(item => item.id === user.id);
      if (!found || found.username || users.some(item => item.username === username)) return null;
      found.username = username;
      await writeFile(localFile, JSON.stringify(users, null, 2));
      return username;
    });
    localQueue = work.catch(() => {});
    return work;
  }
  if (await getCustomerProfileByUsername(username)) return null;
  return (await setCustomerUsername(user.id, username))?.username || null;
}

export async function listCustomerProfiles() {
  if (isLocalDemo()) return (await localRead()).map(user => ({ user_id: user.id, username: user.username || null, email: user.email, created_at: null }));
  return listCustomerProfilesDb();
}

export async function forgotPassword(email, redirectTo) {
  if (isLocalDemo()) {
    const token = randomBytes(32).toString('base64url');
    const work = localQueue.then(async () => {
      const users = await localRead();
      const user = users.find(item => item.email === email);
      if (!user) return null;
      user.reset_hash = createHash('sha256').update(token).digest('hex');
      user.reset_expires = Date.now() + 30 * 60 * 1000;
      await writeFile(localFile, JSON.stringify(users, null, 2));
      return `${redirectTo.replace(/\/$/, '')}/#reset-password?token=${token}`;
    });
    localQueue = work.catch(() => {});
    return work;
  }
  await supabaseAuth(`recover?redirect_to=${encodeURIComponent(redirectTo)}`, { email });
  return null;
}

export async function resetPassword(token, password) {
  if (isLocalDemo()) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const work = localQueue.then(async () => {
      const users = await localRead();
      const user = users.find(item => item.reset_hash === tokenHash && item.reset_expires > Date.now());
      if (!user) throw Object.assign(new Error('ลิงก์หมดอายุหรือไม่ถูกต้อง'), { status: 403 });
      user.salt = randomBytes(16).toString('hex');
      user.hash = (await scrypt(password, user.salt, 64)).toString('hex');
      user.session_version = (user.session_version || 1) + 1;
      delete user.reset_hash;
      delete user.reset_expires;
      await writeFile(localFile, JSON.stringify(users, null, 2));
    });
    localQueue = work.catch(() => {});
    return work;
  }
  await supabaseAuth('user', { password }, 'PUT', token);
}
