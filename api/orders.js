import { randomBytes } from 'node:crypto';
import { body, cleanEmail, fail, json, method, orderView, validateEmail } from '../lib/http.js';
import { createOrder, getBook } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'POST');
    const input = await body(request);
    const book = await getBook(input.bookId);
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!book || name.length < 2 || name.length > 80 || !validateEmail(input.email)) {
      return json({ error: 'กรุณาตรวจชื่อ อีเมล และหนังสือที่เลือก' }, 400);
    }
    const order = await createOrder({
      id: `EB-${randomBytes(12).toString('hex').toUpperCase()}`,
      book_id: book.id,
      customer_name: name,
      email: cleanEmail(input.email),
      status: 'PENDING',
      email_status: 'NOT_SENT',
      created_at: new Date().toISOString()
    });
    return json({ order: orderView(order, book) }, 201);
  } catch (error) { return fail(error); }
} };
