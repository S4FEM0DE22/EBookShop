import { downloadUrl } from '../lib/delivery.js';
import { requireCustomer, sameOrigin } from '../lib/customer-auth.js';
import { body, fail, json, method, orderView } from '../lib/http.js';
import { getOrder, getOrderBooks } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'POST');
    sameOrigin(request);
    const user = await requireCustomer(request);
    const input = await body(request);
    if (typeof input.id !== 'string' || !/^EB-[A-F0-9]{24}$/.test(input.id)) {
      return json({ error: 'ไม่พบคำสั่งซื้อนี้' }, 404);
    }
    const order = await getOrder(input.id);
    if (!order || order.customer_id !== user.id) return json({ error: 'ไม่พบคำสั่งซื้อนี้' }, 404);
    const origin = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
    const books = await getOrderBooks(order);
    const downloadUrls = order.status === 'PAID' ? Object.fromEntries(books.map(book => [book.id, downloadUrl(order, origin, book.id)])) : {};
    return json({ order: orderView(order, books, order.status === 'PAID' ? { downloadUrls, downloadUrl: downloadUrls[books[0]?.id] } : {}) });
  } catch (error) { return fail(error); }
} };
