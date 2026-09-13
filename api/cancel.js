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
    if (order.status === 'PAID') return json({ error: 'คำสั่งซื้อที่ชำระแล้วไม่สามารถยกเลิกในระบบสาธิต' }, 409);
    if (order.status === 'PENDING') {
      order = await updateOrder(order.id, { status: 'CANCELLED', cancelled_at: new Date().toISOString() }, 'PENDING') || await getOrder(order.id);
      if (order.status === 'PAID') return json({ error: 'คำสั่งซื้อที่ชำระแล้วไม่สามารถยกเลิกในระบบสาธิต' }, 409);
    }
    return json({ order: orderView(order, await getOrderBooks(order)) });
  } catch (error) { return fail(error); }
} };
