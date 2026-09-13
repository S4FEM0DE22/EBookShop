import { localBookBytes, signedBookUrl, verifyDownloadToken } from '../lib/delivery.js';
import { fail, json, method } from '../lib/http.js';
import { getBook, getOrder, isLocalDemo } from '../lib/store.js';

export default { async fetch(request) {
  try {
    method(request, 'GET');
    const token = new URL(request.url).searchParams.get('token');
    const grant = verifyDownloadToken(token);
    if (!grant) return json({ error: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' }, 403);
    const order = await getOrder(grant.id);
    if (!order || order.status !== 'PAID') return json({ error: 'ยังไม่สามารถดาวน์โหลดได้' }, 403);
    const ids = Array.isArray(order.book_ids) && order.book_ids.length ? order.book_ids : [order.book_id];
    if (!ids.includes(grant.bookId)) return json({ error: 'ลิงก์ไม่ตรงกับหนังสือ' }, 403);
    const book = await getBook(grant.bookId);
    if (!book) return json({ error: 'ไม่พบหนังสือ' }, 404);
    if (!isLocalDemo()) return Response.redirect(await signedBookUrl(book), 302);
    const bytes = await localBookBytes(book);
    return new Response(bytes, { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${book.file}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    } });
  } catch (error) { return fail(error); }
} };
