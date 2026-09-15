import test from 'node:test';
import assert from 'node:assert/strict';
import adminApi from '../api/admin.js';
import { createOrder } from '../lib/store.js';
import { randomBytes } from 'node:crypto';

const password = 'admin-test-password-with-32-characters';
const endpoint = 'https://shop.example.org/api/admin';
const request = (path = '', input, cookie, origin = 'https://shop.example.org') => new Request(`${endpoint}${path}`, {
  method: input ? 'POST' : 'GET',
  headers: {
    ...(input ? { 'Content-Type': 'application/json', Origin: origin } : {}),
    ...(cookie ? { Cookie: cookie } : {})
  },
  body: input ? JSON.stringify(input) : undefined
});

test('admin data and changes require a valid server-signed session', async () => {
  const previous = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = password;
  try {
    const anonymous = await adminApi.fetch(request('?view=overview'));
    assert.equal(anonymous.status, 401);
    assert.equal((await adminApi.fetch(request('', { action: 'set-book-active', id: 'media-player-pro', active: false }))).status, 401);
    assert.equal((await adminApi.fetch(request('', { action: 'login', password: 'incorrect-password' }))).status, 401);
    assert.equal((await adminApi.fetch(request('', { action: 'login', password }, undefined, 'https://evil.example.org'))).status, 403);

    const login = await adminApi.fetch(request('', { action: 'login', password }));
    assert.equal(login.status, 200);
    const cookieHeader = login.headers.get('set-cookie');
    assert.match(cookieHeader, /HttpOnly; SameSite=Strict; Path=\/api\/admin/);
    assert.match(cookieHeader, /; Secure$/);
    const cookie = cookieHeader.split(';')[0];
    const session = await adminApi.fetch(request('?view=session', undefined, cookie));
    assert.equal((await session.json()).authenticated, true);
    const overview = await adminApi.fetch(request('?view=overview', undefined, cookie));
    assert.equal(overview.status, 200);
    const data = await overview.json();
    assert.equal(data.books.length, 4);
    assert.ok(data.books.every(book => !('file' in book)));
    assert.ok(Array.isArray(data.orders));
    assert.ok(Array.isArray(data.customers));
    assert.ok(data.customers.every(customer => !('hash' in customer) && !('session_version' in customer)));
    assert.equal((await adminApi.fetch(request('?view=overview', undefined, `${cookie}tampered`))).status, 401);
    const editable = data.books.find(book => book.id === 'media-player-pro');
    const updated = await adminApi.fetch(request('', { action: 'update-book', id: editable.id, title: editable.title, subtitle: editable.subtitle, description: editable.description, author: editable.author, price: editable.price }, cookie));
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).book.id, editable.id);
    assert.equal((await adminApi.fetch(request('', { action: 'update-book', id: editable.id, title: '', subtitle: '', description: '', author: '', price: 0 }, cookie))).status, 400);

    // Test add-book via multipart FormData
    const addFd = new FormData();
    addFd.append('action', 'add-book');
    addFd.append('title', 'Unit Test Ebook');
    addFd.append('subtitle', 'คู่มือทดสอบระบบ');
    addFd.append('description', 'เนื้อหาทดสอบระบบเพิ่มหนังสือผ่านระบบผู้ดูแล SAFEMODE SHOP');
    addFd.append('author', 'Tester');
    addFd.append('price', '89');
    addFd.append('file', new Blob(['sample epub content'], { type: 'application/epub+zip' }), 'test-book.epub');

    const addReq = new Request(endpoint, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: 'https://shop.example.org' },
      body: addFd
    });
    const addRes = await adminApi.fetch(addReq);
    assert.equal(addRes.status, 200);
    const addedData = await addRes.json();
    assert.ok(addedData.book.id.startsWith('unit-test-ebook'));

    // Verify in overview
    const overviewAfterAdd = await (await adminApi.fetch(request('?view=overview', undefined, cookie))).json();
    assert.equal(overviewAfterAdd.books.length, 5);
    const addedBookInList = overviewAfterAdd.books.find(b => b.id === addedData.book.id);
    assert.ok(addedBookInList);
    assert.equal(addedBookInList.fileName.endsWith('.epub'), true);

    // Test delete-book
    const delRes = await adminApi.fetch(request('', { action: 'delete-book', id: addedData.book.id }, cookie));
    assert.equal(delRes.status, 200);

    // Verify restored count
    const overviewAfterDel = await (await adminApi.fetch(request('?view=overview', undefined, cookie))).json();
    assert.equal(overviewAfterDel.books.length, 4);

    const id = `EB-${randomBytes(12).toString('hex').toUpperCase()}`;
    await createOrder({ id, book_id: 'tarot-app', book_ids: ['tarot-app'], customer_name: 'ลูกค้า ทดสอบ', email: 'admin-flow@example.test', status: 'PENDING', email_status: 'NOT_SENT', created_at: new Date().toISOString() });
    const marked = await adminApi.fetch(request('', { action: 'mark-paid', id }, cookie));
    assert.equal(marked.status, 200);
    assert.equal((await marked.json()).order.status, 'PAID');

    const logout = await adminApi.fetch(request('', { action: 'logout' }, cookie));
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previous;
  }
});
