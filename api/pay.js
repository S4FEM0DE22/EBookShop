import { deliverEmail, downloadUrl } from '../lib/delivery.js';
import { body, cleanEmail, fail, json, method, orderView, validateEmail } from '../lib/http.js';
import { getOrder, getOrderBooks, updateOrder } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'POST');
    const input = await body(request);
    if (typeof input.id !== 'string' || !/^EB-[A-F0-9]{24}$/.test(input.id) || !validateEmail(input.email)) {
      return json({ error: 'ไม่พบคำสั่งซื้อนี้' }, 404);
    }
    let order = await getOrder(input.id);
    if (!order || order.email !== cleanEmail(input.email)) return json({ error: 'ไม่พบคำสั่งซื้อนี้' }, 404);
    if (order.status === 'CANCELLED') return json({ error: 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว' }, 409);
    const books = await getOrderBooks(order);
    const origin = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
    if (order.status === 'PENDING') {
      order = await updateOrder(order.id, { status: 'PAID', paid_at: new Date().toISOString() }, 'PENDING') || await getOrder(order.id);
      if (order.status === 'CANCELLED') return json({ error: 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว' }, 409);
    }
    let delivery = { emailStatus: order.email_status, downloadUrls: Object.fromEntries(books.map(book => [book.id, downloadUrl(order, origin, book.id)])) };
    if (order.email_status !== 'SENT') {
      delivery = await deliverEmail(order, books, origin);
      order = await updateOrder(order.id, { email_status: delivery.emailStatus });
    }
    return json({ order: orderView(order, books, { downloadUrls: delivery.downloadUrls, downloadUrl: delivery.downloadUrls[books[0]?.id] }) });
  } catch (error) { return fail(error); }
} };
