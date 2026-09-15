import { claimUsername, clearSessionCookie, customer, forgotPassword, login, register, resetPassword, sameOrigin, sessionCookie, updateCustomerProfile } from '../lib/customer-auth.js';
import { body, cleanEmail, fail, json, orderView, validateEmail } from '../lib/http.js';
import { listCustomerOrders, listAllBooks } from '../lib/store.js';

function reply(data, status = 200, cookie) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(data, { status, headers });
}
function publicUser(user) {
  let firstName = user.firstName || user.first_name || '';
  let lastName = user.lastName || user.last_name || '';
  if (!firstName && !lastName && user.name && user.name !== user.username) {
    const parts = user.name.trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }
  return {
    name: user.name,
    firstName,
    lastName,
    first_name: firstName,
    last_name: lastName,
    email: user.email,
    username: user.username || null
  };
}
const validUsername = value => typeof value === 'string' && /^[a-z0-9_]{3,24}$/.test(value);

export default { async fetch(request) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const user = await customer(request);
      if (url.searchParams.get('view') === 'session') return json({ user: user ? publicUser(user) : null });
      if (url.searchParams.get('view') === 'orders') {
        if (!user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
        const [rows, books] = await Promise.all([listCustomerOrders(user.id), listAllBooks()]);
        const bookMap = new Map(books.map(book => [book.id, book]));
        return json({ orders: rows.map(order => orderView(order, (Array.isArray(order.book_ids) && order.book_ids.length ? order.book_ids : [order.book_id]).map(id => bookMap.get(id)).filter(Boolean))) });
      }
      return json({ error: 'ไม่พบข้อมูล' }, 404);
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    sameOrigin(request);
    const input = await body(request);
    if (input.action === 'logout') return reply({ user: null }, 200, clearSessionCookie(request));
    if (input.action === 'claim-username') {
      const user = await customer(request);
      if (!user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
      if (user.username) return json({ error: 'บัญชีนี้มี Username แล้ว' }, 409);
      const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
      if (!validUsername(username)) return json({ error: 'Username ต้องมี 3–24 ตัว ใช้ a-z, 0-9 หรือ _' }, 400);
      if (!await claimUsername(user, username)) return json({ error: 'Username นี้มีคนใช้แล้ว' }, 409);
      return reply({ user: publicUser({ ...user, username }) }, 200, sessionCookie(request, { ...user, username }));
    }
    if (input.action === 'update-profile') {
      const user = await customer(request);
      if (!user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
      const first = typeof input.first === 'string' ? input.first.trim() : (typeof input.firstName === 'string' ? input.firstName.trim() : '');
      const last = typeof input.last === 'string' ? input.last.trim() : (typeof input.lastName === 'string' ? input.lastName.trim() : '');
      if (!first) return json({ error: 'กรุณากรอกชื่อ' }, 400);
      if (first.length > 80 || last.length > 80) return json({ error: 'ชื่อหรือนามสกุลยาวเกินไป (ไม่เกิน 80 ตัวอักษร)' }, 400);
      let currentUsername = user.username;
      if (!currentUsername && typeof input.username === 'string' && input.username.trim()) {
        const claim = input.username.trim().toLowerCase();
        if (!validUsername(claim)) return json({ error: 'Username ต้องมี 3–24 ตัว ใช้ a-z, 0-9 หรือ _' }, 400);
        if (!await claimUsername(user, claim)) return json({ error: 'Username นี้มีคนใช้แล้ว' }, 409);
        currentUsername = claim;
      }
      const updatedUser = await updateCustomerProfile({ ...user, username: currentUsername }, first, last);
      return reply({ user: publicUser(updatedUser) }, 200, sessionCookie(request, updatedUser));
    }
    if (input.action === 'reset-password') {
      const token = typeof input.token === 'string' ? input.token : '';
      const password = typeof input.password === 'string' ? input.password : '';
      if (token.length < 20 || token.length > 3000 || password.length < 8 || password.length > 128) return json({ error: 'ลิงก์หรือรหัสผ่านไม่ถูกต้อง' }, 400);
      await resetPassword(token, password);
      return reply({ changed: true }, 200, clearSessionCookie(request));
    }
    const email = validateEmail(input.email) ? cleanEmail(input.email) : '';
    if (input.action === 'forgot-password') {
      if (!email) return json({ error: 'กรุณากรอกอีเมลที่ใช้สมัคร' }, 400);
      const origin = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_SITE_URL)?.replace(/\/$/, '') || new URL(request.url).origin;
      const demoResetUrl = await forgotPassword(email, `${origin}/`);
      return json({ sent: true, ...(demoResetUrl ? { demoResetUrl } : {}) });
    }
    const password = typeof input.password === 'string' ? input.password : '';
    if (password.length < 8 || password.length > 128) return json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, 400);
    if (input.action === 'login') {
      const identifier = typeof input.identifier === 'string' ? input.identifier.trim().toLowerCase() : email;
      if (!validUsername(identifier) && !validateEmail(identifier)) return json({ error: 'กรุณากรอก Username หรืออีเมล' }, 400);
      const user = await login(identifier, password);
      return reply({ user: publicUser(user) }, 200, sessionCookie(request, user));
    }
    if (input.action === 'register') {
      const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
      if (!validUsername(username) || !email) return json({ error: 'กรุณาตรวจ Username และอีเมล (Username ใช้ a-z, 0-9 หรือ _ จำนวน 3–24 ตัว)' }, 400);
      if (input.confirmPassword != null && input.confirmPassword !== password) return json({ error: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' }, 400);
      const result = await register(username, email, password);
      if (result.confirmationRequired) return reply({ user: null, confirmationRequired: true }, 201);
      return reply({ user: publicUser(result.user), confirmationRequired: false }, 201, sessionCookie(request, result.user));
    }
    return json({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
  } catch (error) { return fail(error); }
} };
