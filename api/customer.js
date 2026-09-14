import { clearSessionCookie, customer, login, register, sameOrigin, sessionCookie } from '../lib/customer-auth.js';
import { body, cleanEmail, fail, json, orderView, validateEmail } from '../lib/http.js';
import { listCustomerOrders, getOrderBooks } from '../lib/store.js';

function reply(data, status = 200, cookie) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(data, { status, headers });
}
function publicUser(user) { return { name: user.name, email: user.email }; }

export default { async fetch(request) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const user = customer(request);
      if (url.searchParams.get('view') === 'session') return json({ user: user ? publicUser(user) : null });
      if (url.searchParams.get('view') === 'orders') {
        if (!user) return json({ error: 'กรุณาเข้าสู่ระบบ' }, 401);
        const rows = await listCustomerOrders(user.email);
        return json({ orders: await Promise.all(rows.map(async order => orderView(order, await getOrderBooks(order)))) });
      }
      return json({ error: 'ไม่พบข้อมูล' }, 404);
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    sameOrigin(request);
    const input = await body(request);
    if (input.action === 'logout') return reply({ user: null }, 200, clearSessionCookie(request));
    const email = validateEmail(input.email) ? cleanEmail(input.email) : '';
    const password = typeof input.password === 'string' ? input.password : '';
    if (!email || password.length < 8 || password.length > 128) return json({ error: 'กรุณาตรวจอีเมลและรหัสผ่านอย่างน้อย 8 ตัวอักษร' }, 400);
    if (input.action === 'login') {
      const user = await login(email, password);
      return reply({ user: publicUser(user) }, 200, sessionCookie(request, user));
    }
    if (input.action === 'register') {
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (name.length < 2 || name.length > 80) return json({ error: 'กรุณากรอกชื่อ 2–80 ตัวอักษร' }, 400);
      const result = await register(name, email, password);
      if (result.confirmationRequired) return reply({ user: null, confirmationRequired: true }, 201);
      return reply({ user: publicUser(result.user), confirmationRequired: false }, 201, sessionCookie(request, result.user));
    }
    return json({ error: 'คำสั่งไม่ถูกต้อง' }, 400);
  } catch (error) { return fail(error); }
} };
