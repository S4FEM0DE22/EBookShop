import { downloadUrl } from '../lib/delivery.js';
import { body, cleanEmail, fail, json, method, orderView, validateEmail } from '../lib/http.js';
import { getBook, getOrder } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'POST');
    const input = await body(request);
    if (typeof input.id !== 'string' || !/^EB-[A-F0-9]{24}$/.test(input.id) || !validateEmail(input.email)) {
      return json({ error: 'ไม่พบคำสั่งซื้อนี้' }, 404);
    }
    const order = await getOrder(input.id);
    if (!order || order.email !== cleanEmail(input.email)) return json({ error: 'ไม่พบคำสั่งซื้อนี้' }, 404);
    const origin = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
    return json({ order: orderView(order, await getBook(order.book_id), order.status === 'PAID' ? { downloadUrl: downloadUrl(order, origin) } : {}) });
  } catch (error) { return fail(error); }
} };
