import test from 'node:test';
import assert from 'node:assert/strict';
import booksApi from '../api/books.js';
import ordersApi from '../api/orders.js';
import orderApi from '../api/order.js';
import payApi from '../api/pay.js';
import cancelApi from '../api/cancel.js';
import downloadApi from '../api/download.js';
import { makeDownloadToken, signedBookUrl } from '../lib/delivery.js';

const request = (path, data) => new Request(`http://localhost:3000/api/${path}`, {
  method: data ? 'POST' : 'GET',
  headers: data ? { 'Content-Type': 'application/json' } : {},
  body: data ? JSON.stringify(data) : undefined
});

test('private storage signed URL uses the storage endpoint and server-only key', async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  const oldFetch = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://sample.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test_only';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://sample.supabase.co/storage/v1/object/sign/ebooks/media-player-pro.pdf');
    assert.equal(options.headers.apikey, 'sb_secret_test_only');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { expiresIn: 300 });
    return Response.json({ signedURL: '/object/sign/ebooks/media-player-pro.pdf?token=sample' });
  };
  try {
    const url = await signedBookUrl({ file: 'media-player-pro.pdf' });
    assert.equal(url, 'https://sample.supabase.co/storage/v1/object/sign/ebooks/media-player-pro.pdf?token=sample&download=media-player-pro.pdf');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});

test('complete local demo flow and protect order lookup and download', async () => {
  const catalog = await (await booksApi.fetch(request('books'))).json();
  assert.equal(catalog.books.length, 4);
  assert.ok(catalog.books.every(item => item.title && item.description && item.price));
  assert.deepEqual(catalog.books.map(item => item.id), ['media-player-pro', 'tarot-app', 'sqlite-task-manager-guide', 'sqlite-task-manager-report']);
  assert.ok(catalog.books.every(item => item.cover.startsWith('/assets/covers/') && !('file' in item)));

  const created = await ordersApi.fetch(request('orders', { bookId: 'media-player-pro', name: 'ทดสอบ ระบบ', email: 'Test@Example.com' }));
  assert.equal(created.status, 201);
  const order = (await created.json()).order;
  assert.match(order.id, /^EB-[A-F0-9]{24}$/);
  assert.equal(order.status, 'PENDING');
  assert.equal(order.email, 'test@example.com');

  const badLookup = await orderApi.fetch(request('order', { id: order.id, email: 'other@example.com' }));
  assert.equal(badLookup.status, 404);
  const badPay = await payApi.fetch(request('pay', { id: order.id, email: 'other@example.com' }));
  assert.equal(badPay.status, 404);

  const lookedUp = await orderApi.fetch(request('order', { id: order.id, email: order.email }));
  assert.equal((await lookedUp.json()).order.status, 'PENDING');
  const paidResponse = await payApi.fetch(request('pay', { id: order.id, email: order.email }));
  const paid = (await paidResponse.json()).order;
  assert.equal(paid.status, 'PAID');
  assert.equal(paid.emailStatus, 'DEMO');
  assert.ok(paid.downloadUrl);
  const lateCancel = await cancelApi.fetch(request('cancel', { id: order.id, email: order.email }));
  assert.equal(lateCancel.status, 409);

  const download = await downloadApi.fetch(new Request(paid.downloadUrl));
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  const header = Buffer.from(await download.arrayBuffer()).subarray(0, 4).toString();
  assert.equal(header, '%PDF');

  const invalid = await downloadApi.fetch(request('download?token=invalid'));
  assert.equal(invalid.status, 403);
  const revisited = await orderApi.fetch(request('order', { id: order.id, email: order.email }));
  assert.ok((await revisited.json()).order.downloadUrl);
});

test('cart checkout keeps multiple books together and scopes each download', async () => {
  const response = await ordersApi.fetch(request('orders', {
    bookIds: ['media-player-pro', 'tarot-app', 'sqlite-task-manager-guide', 'sqlite-task-manager-report'],
    name: 'ผู้ทดสอบ',
    email: 'cart@example.com'
  }));
  assert.equal(response.status, 201);
  const created = (await response.json()).order;
  assert.equal(created.status, 'PENDING');
  assert.equal(created.items.length, 4);
  assert.equal(created.price, created.items.reduce((sum, item) => sum + item.price, 0));

  const paid = (await (await payApi.fetch(request('pay', { id: created.id, email: created.email }))).json()).order;
  assert.equal(paid.status, 'PAID');
  assert.equal(Object.keys(paid.downloadUrls).length, 4);
  for (const item of paid.items) {
    const file = await downloadApi.fetch(new Request(paid.downloadUrls[item.id]));
    assert.equal(file.status, 200);
    assert.match(file.headers.get('content-disposition'), new RegExp(`${item.id}\\.pdf`));
  }
  const unrelated = makeDownloadToken({ id: created.id, book_id: 'vibe-coding' });
  const forbidden = await downloadApi.fetch(request(`download?token=${unrelated}`));
  assert.equal(forbidden.status, 403);
});

test('pending orders can be cancelled but cannot be paid or downloaded afterward', async () => {
  const created = await ordersApi.fetch(request('orders', { bookId: 'tarot-app', name: 'ยกเลิก ทดสอบ', email: 'cancel@example.com' }));
  const order = (await created.json()).order;
  const wrongEmail = await cancelApi.fetch(request('cancel', { id: order.id, email: 'other@example.com' }));
  assert.equal(wrongEmail.status, 404);

  const cancelled = await cancelApi.fetch(request('cancel', { id: order.id, email: order.email }));
  assert.equal((await cancelled.json()).order.status, 'CANCELLED');
  const lookup = await orderApi.fetch(request('order', { id: order.id, email: order.email }));
  assert.equal((await lookup.json()).order.status, 'CANCELLED');
  const paid = await payApi.fetch(request('pay', { id: order.id, email: order.email }));
  assert.equal(paid.status, 409);
  const token = makeDownloadToken({ id: order.id, book_id: 'tarot-app' });
  const download = await downloadApi.fetch(request(`download?token=${token}`));
  assert.equal(download.status, 403);
});
