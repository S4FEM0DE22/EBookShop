import { randomBytes } from 'node:crypto';
import { body, cleanEmail, fail, json, method, orderView, validateEmail } from '../lib/http.js';
import { createOrder, getBook } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'POST');
    const input = await body(request);
    const ids = Array.isArray(input.bookIds) ? input.bookIds : [input.bookId];
    if (ids.length < 1 || ids.length > 3 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
      return json({ error: 'เลือกหนังสืออย่างน้อยหนึ่งเล่ม' }, 400);
    }
    const books = await Promise.all(ids.map(getBook));
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (books.some(book => !book) || name.length < 2 || name.length > 80 || !validateEmail(input.email)) {
      return json({ error: 'กรุณาตรวจชื่อ อีเมล และหนังสือที่เลือก' }, 400);
    }
    const order = await createOrder({
      id: `EB-${randomBytes(12).toString('hex').toUpperCase()}`,
      book_id: books[0].id,
      book_ids: books.map(book => book.id),
      customer_name: name,
      email: cleanEmail(input.email),
      status: 'PENDING',
      email_status: 'NOT_SENT',
      created_at: new Date().toISOString()
    });
    return json({ order: orderView(order, books) }, 201);
  } catch (error) { return fail(error); }
} };
