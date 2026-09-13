import { deliverEmail, downloadUrl } from '../lib/delivery.js';
import { body, cleanEmail, fail, json, method, orderView, validateEmail } from '../lib/http.js';
import { getBook, getOrder, updateOrder } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'POST');
    const input = await body(request);
    if (typeof input.id !== 'string' || !/^EB-[A-F0-9]{24}$/.test(input.id) || !validateEmail(input.email)) {
      return json({ error: 'ไม่พบคำสั่งซื้อนี้' }, 404);
    }
    let order = await getOrder(input.id);
    if (!order || order.email !== cleanEmail(input.email)) return json({ error: 'ไม่พบคำสั่งซื้อนี้' }, 404);
    const book = await getBook(order.book_id);
    const origin = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
    if (order.status !== 'PAID') order = await updateOrder(order.id, { status: 'PAID', paid_at: new Date().toISOString() });
    let delivery = { emailStatus: order.email_status, downloadUrl: downloadUrl(order, origin) };
    if (order.email_status !== 'SENT') {
      delivery = await deliverEmail(order, book, origin);
      order = await updateOrder(order.id, { email_status: delivery.emailStatus });
    }
    return json({ order: orderView(order, book, { downloadUrl: delivery.downloadUrl }) });
  } catch (error) { return fail(error); }
} };
