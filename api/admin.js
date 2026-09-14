import { adminConfigured, clearSessionCookie, correctPassword, isAdmin, sessionCookie } from '../lib/admin-auth.js';
import { body, fail, json, orderView } from '../lib/http.js';
import { books as currentBooks } from '../lib/catalog.js';
import { getOrder, listAllBooks, listOrders, setBookActive } from '../lib/store.js';
import payApi from './pay.js';
import cancelApi from './cancel.js';

function reply(data, status = 200, cookie) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(data, { status, headers });
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw Object.assign(new Error('คำขอไม่ได้มาจากเว็บไซต์นี้'), { status: 403 });
}

function requireAdmin(request) {
  if (!isAdmin(request)) throw Object.assign(new Error('กรุณาเข้าสู่ระบบผู้ดูแล'), { status: 401 });
}

async function changeOrder(request, input) {
  if (!['mark-paid', 'cancel-order', 'retry-email'].includes(input.action) || typeof input.id !== 'string' || !/^EB-[A-F0-9]{24}$/.test(input.id)) {
    throw new Error('คำสั่งไม่ถูกต้อง');
  }
  const order = await getOrder(input.id);
  if (!order) throw Object.assign(new Error('ไม่พบคำสั่งซื้อ'), { status: 404 });
  if (input.action === 'mark-paid' && order.status !== 'PENDING') throw Object.assign(new Error('รายการนี้ไม่รอชำระเงินแล้ว'), { status: 409 });
  if (input.action === 'cancel-order' && order.status !== 'PENDING') throw Object.assign(new Error('ยกเลิกได้เฉพาะรายการที่รอชำระเงิน'), { status: 409 });
  if (input.action === 'retry-email' && order.status !== 'PAID') throw Object.assign(new Error('ส่งอีเมลได้หลังชำระเงินเท่านั้น'), { status: 409 });
  const handler = input.action === 'cancel-order' ? cancelApi : payApi;
  const response = await handler.fetch(new Request(new URL(input.action === 'cancel-order' ? '/api/cancel' : '/api/pay', request.url), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') || '' }, body: JSON.stringify({ id: order.id })
  }));
  return reply(await response.json(), response.status);
}

export default { async fetch(request) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (url.searchParams.get('view') === 'session') return json({ authenticated: isAdmin(request), configured: adminConfigured() });
      requireAdmin(request);
      if (url.searchParams.get('view') !== 'overview') throw Object.assign(new Error('ไม่พบข้อมูล'), { status: 404 });
      const [books, orders] = await Promise.all([listAllBooks(), listOrders()]);
      const bookMap = new Map(books.map(book => [book.id, book]));
      const currentIds = new Set(currentBooks.map(book => book.id));
      return json({
        books: books.filter(book => currentIds.has(book.id)).map(({ file, ...book }) => book),
        orders: orders.map(order => orderView(order, (Array.isArray(order.book_ids) && order.book_ids.length ? order.book_ids : [order.book_id]).map(id => bookMap.get(id)).filter(Boolean))),
        emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && !process.env.RESEND_API_KEY.includes('REPLACE'))
      });
    }
    if (request.method !== 'POST') throw Object.assign(new Error('Method not allowed'), { status: 405 });
    sameOrigin(request);
    const input = await body(request);
    if (input.action === 'login') {
      if (!adminConfigured()) throw Object.assign(new Error('ยังไม่ได้ตั้งค่ารหัสผู้ดูแล'), { status: 503 });
      if (!correctPassword(input.password)) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
      return reply({ authenticated: true }, 200, sessionCookie(request));
    }
    requireAdmin(request);
    if (input.action === 'logout') return reply({ authenticated: false }, 200, clearSessionCookie(request));
    if (input.action === 'set-book-active') {
      if (typeof input.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.id) || typeof input.active !== 'boolean') throw new Error('ข้อมูลหนังสือไม่ถูกต้อง');
      if (!currentBooks.some(book => book.id === input.id)) throw Object.assign(new Error('หนังสือนี้จัดการจากแดชบอร์ดไม่ได้'), { status: 404 });
      const book = await setBookActive(input.id, input.active);
      if (!book) throw Object.assign(new Error('ไม่พบหนังสือ'), { status: 404 });
      return json({ book: { id: book.id, active: book.active } });
    }
    return changeOrder(request, input);
  } catch (error) { return fail(error); }
} };
