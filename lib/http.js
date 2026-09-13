export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function body(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('ส่งข้อมูลไม่ถูกต้อง');
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 4096) throw new Error('ข้อมูลยาวเกินไป');
  return request.json();
}

export function fail(error) {
  const status = error.status || 400;
  if (status >= 500) console.error(error);
  return json({ error: status >= 500 ? 'ระบบขัดข้อง กรุณาลองใหม่' : error.message }, status);
}

export function method(request, expected) {
  if (request.method !== expected) throw Object.assign(new Error('Method not allowed'), { status: 405 });
}

export function validateEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function cleanEmail(email) {
  return email.trim().toLowerCase();
}

export function orderView(order, books, extra = {}) {
  const items = (Array.isArray(books) ? books : [books]).filter(Boolean).map(book => ({
    id: book.id,
    title: book.title,
    subtitle: book.subtitle,
    description: book.description,
    cover: book.cover,
    price: book.price
  }));
  return {
    id: order.id,
    bookId: items[0]?.id,
    title: items[0]?.title,
    price: items.reduce((sum, item) => sum + item.price, 0),
    items,
    customerName: order.customer_name,
    email: order.email,
    status: order.status,
    emailStatus: order.email_status,
    createdAt: order.created_at,
    ...extra
  };
}
