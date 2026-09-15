import test from 'node:test';
import assert from 'node:assert/strict';
import booksApi from '../api/books.js';
import customerApi from '../api/customer.js';
import ordersApi from '../api/orders.js';
import orderApi from '../api/order.js';
import payApi from '../api/pay.js';
import cancelApi from '../api/cancel.js';
import downloadApi from '../api/download.js';
import { makeDownloadToken, signedBookUrl } from '../lib/delivery.js';
import { randomUUID } from 'node:crypto';

const request = (path, data, cookie) => new Request(`http://localhost:3000/api/${path}`, {
  method: data ? 'POST' : 'GET',
  headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
  body: data ? JSON.stringify(data) : undefined
});

async function account(label) {
  const email = `${label}-${randomUUID()}@example.com`;
  const username = `${label}_${randomUUID().slice(0, 8)}`;
  const password = 'local-test-password-123';
  const registration = await customerApi.fetch(request('customer', { action: 'register', username, email, password }));
  assert.equal(registration.status, 201);
  assert.match(registration.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Path=\/api/);
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  return { email, username, password, cookie };
}

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
  const buyer = await account('buyer');
  const stranger = await account('stranger');
  const catalog = await (await booksApi.fetch(request('books'))).json();
  assert.equal(catalog.books.length, 4);
  assert.ok(catalog.books.every(item => item.title && item.description && item.price));
  assert.deepEqual(catalog.books.map(item => item.id), ['media-player-pro', 'tarot-app', 'sqlite-task-manager-guide', 'sqlite-task-manager-report']);
  assert.ok(catalog.books.every(item => item.cover.startsWith('/assets/covers/') && !('file' in item)));

  assert.equal((await ordersApi.fetch(request('orders', { bookId: 'media-player-pro', name: 'ทดสอบ ระบบ' }))).status, 401);
  const created = await ordersApi.fetch(request('orders', { bookId: 'media-player-pro', name: 'ทดสอบ ระบบ', email: stranger.email }, buyer.cookie));
  assert.equal(created.status, 201);
  const order = (await created.json()).order;
  assert.match(order.id, /^EB-[A-F0-9]{24}$/);
  assert.equal(order.status, 'PENDING');
  assert.equal(order.email, buyer.email);

  const wrongEmail = await orderApi.fetch(request('order', { id: order.id, email: stranger.email }));
  assert.equal(wrongEmail.status, 404);
  const publicLookup = await orderApi.fetch(request('order', { id: order.id, email: buyer.email }));
  assert.equal(publicLookup.status, 200);
  const publicOrder = (await publicLookup.json()).order;
  assert.equal(publicOrder.status, 'PENDING');
  assert.equal(publicOrder.email, undefined);
  assert.equal(publicOrder.customerName, undefined);
  assert.equal(publicOrder.downloadUrl, undefined);

  const badLookup = await orderApi.fetch(request('order', { id: order.id, email: buyer.email }, stranger.cookie));
  assert.equal(badLookup.status, 404);
  const badPay = await payApi.fetch(request('pay', { id: order.id, email: buyer.email }, stranger.cookie));
  assert.equal(badPay.status, 404);

  const lookedUp = await orderApi.fetch(request('order', { id: order.id }, buyer.cookie));
  assert.equal((await lookedUp.json()).order.status, 'PENDING');
  const paidResponse = await payApi.fetch(request('pay', { id: order.id }, buyer.cookie));
  const paid = (await paidResponse.json()).order;
  assert.equal(paid.status, 'PAID');
  assert.equal(paid.emailStatus, 'DEMO');
  assert.ok(paid.downloadUrl);
  const publicPaid = (await (await orderApi.fetch(request('order', { id: order.id, email: buyer.email }))).json()).order;
  assert.equal(publicPaid.status, 'PAID');
  assert.equal(publicPaid.downloadUrls, undefined);
  const lateCancel = await cancelApi.fetch(request('cancel', { id: order.id }, buyer.cookie));
  assert.equal(lateCancel.status, 409);

  const download = await downloadApi.fetch(new Request(paid.downloadUrl));
  assert.equal(download.status, 200);
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  const header = Buffer.from(await download.arrayBuffer()).subarray(0, 4).toString();
  assert.equal(header, '%PDF');

  const invalid = await downloadApi.fetch(request('download?token=invalid'));
  assert.equal(invalid.status, 403);
  const revisited = await orderApi.fetch(request('order', { id: order.id }, buyer.cookie));
  assert.ok((await revisited.json()).order.downloadUrl);
  const history = await customerApi.fetch(request('customer?view=orders', undefined, buyer.cookie));
  assert.ok((await history.json()).orders.some(item => item.id === order.id));
  const unrelatedHistory = await customerApi.fetch(request('customer?view=orders', undefined, stranger.cookie));
  assert.ok(!(await unrelatedHistory.json()).orders.some(item => item.id === order.id));
  const login = await customerApi.fetch(request('customer', { action: 'login', email: buyer.email, password: buyer.password }));
  assert.equal(login.status, 200);
  assert.equal((await login.json()).user.email, buyer.email);
  assert.equal((await customerApi.fetch(request('customer', { action: 'login', identifier: buyer.username, password: buyer.password }))).status, 200);
  assert.equal((await customerApi.fetch(request('customer', { action: 'login', email: buyer.email, password: 'wrong-password' }))).status, 401);
  assert.equal((await customerApi.fetch(request('customer', { action: 'register', username: `new_${randomUUID().slice(0, 8)}`, email: `new-${randomUUID()}@example.com`, password: 'password-123', confirmPassword: 'wrong-password' }))).status, 400);
  const logout = await customerApi.fetch(request('customer', { action: 'logout' }, buyer.cookie));
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('password recovery invalidates previous sessions and preserves account ownership', async () => {
  const buyer = await account('recover');
  const created = await ordersApi.fetch(request('orders', { bookId: 'tarot-app', name: 'ผู้ซื้อ' }, buyer.cookie));
  assert.equal(created.status, 201);
  const oldOrder = (await created.json()).order;
  const forgot = await customerApi.fetch(request('customer', { action: 'forgot-password', email: buyer.email }));
  assert.equal(forgot.status, 200);
  const link = (await forgot.json()).demoResetUrl;
  assert.ok(link);
  const token = new URL(link).hash.split('token=')[1];
  const changed = await customerApi.fetch(request('customer', { action: 'reset-password', token, password: 'fresh-password-456' }));
  assert.equal(changed.status, 200);
  assert.equal((await orderApi.fetch(request('order', { id: oldOrder.id }, buyer.cookie))).status, 401);
  assert.equal((await customerApi.fetch(request('customer', { action: 'login', identifier: buyer.username, password: buyer.password }))).status, 401);
  const newLogin = await customerApi.fetch(request('customer', { action: 'login', identifier: buyer.username, password: 'fresh-password-456' }));
  assert.equal(newLogin.status, 200);
  const newCookie = newLogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await orderApi.fetch(request('order', { id: oldOrder.id }, newCookie))).status, 200);
  assert.equal((await customerApi.fetch(request('customer', { action: 'reset-password', token, password: 'another-password' }))).status, 403);
});

test('cart checkout keeps multiple books together and scopes each download', async () => {
  const buyer = await account('cart');
  const response = await ordersApi.fetch(request('orders', {
    bookIds: ['media-player-pro', 'tarot-app', 'sqlite-task-manager-guide', 'sqlite-task-manager-report'],
    name: 'ผู้ทดสอบ',
    email: 'spoofed@example.com'
  }, buyer.cookie));
  assert.equal(response.status, 201);
  const created = (await response.json()).order;
  assert.equal(created.status, 'PENDING');
  assert.equal(created.email, buyer.email);
  assert.equal(created.items.length, 4);
  assert.equal(created.price, created.items.reduce((sum, item) => sum + item.price, 0));

  const paid = (await (await payApi.fetch(request('pay', { id: created.id }, buyer.cookie))).json()).order;
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
  const buyer = await account('cancel');
  const stranger = await account('other');
  const created = await ordersApi.fetch(request('orders', { bookId: 'tarot-app', name: 'ยกเลิก ทดสอบ' }, buyer.cookie));
  const order = (await created.json()).order;
  const wrongEmail = await cancelApi.fetch(request('cancel', { id: order.id, email: buyer.email }, stranger.cookie));
  assert.equal(wrongEmail.status, 404);

  const cancelled = await cancelApi.fetch(request('cancel', { id: order.id }, buyer.cookie));
  assert.equal((await cancelled.json()).order.status, 'CANCELLED');
  const lookup = await orderApi.fetch(request('order', { id: order.id }, buyer.cookie));
  assert.equal((await lookup.json()).order.status, 'CANCELLED');
  const paid = await payApi.fetch(request('pay', { id: order.id }, buyer.cookie));
  assert.equal(paid.status, 409);
  const token = makeDownloadToken({ id: order.id, book_id: 'tarot-app' });
  const download = await downloadApi.fetch(request(`download?token=${token}`));
  assert.equal(download.status, 403);
});

test('customer profile update saves name fields and updates session', async () => {
  const buyer = await account('profile');
  const sessionRes1 = await customerApi.fetch(request('customer?view=session', undefined, buyer.cookie));
  assert.equal(sessionRes1.status, 200);
  const user1 = (await sessionRes1.json()).user;
  assert.equal(user1.email, buyer.email);
  assert.equal(user1.username, buyer.username);

  const updateRes = await customerApi.fetch(request('customer', {
    action: 'update-profile',
    first: 'นพนันท์',
    last: 'ศุภมาตร์'
  }, buyer.cookie));
  assert.equal(updateRes.status, 200);
  const updatedCookie = updateRes.headers.get('set-cookie')?.split(';')[0];
  assert.ok(updatedCookie);
  const updatedUser = (await updateRes.json()).user;
  assert.equal(updatedUser.firstName, 'นพนันท์');
  assert.equal(updatedUser.lastName, 'ศุภมาตร์');
  assert.equal(updatedUser.name, 'นพนันท์ ศุภมาตร์');

  const sessionRes2 = await customerApi.fetch(request('customer?view=session', undefined, updatedCookie));
  const user2 = (await sessionRes2.json()).user;
  assert.equal(user2.firstName, 'นพนันท์');
  assert.equal(user2.lastName, 'ศุภมาตร์');
  assert.equal(user2.name, 'นพนันท์ ศุภมาตร์');
});

test('customer registration with first and last name populates profile and session', async () => {
  const email = `reg-test-${randomUUID()}@example.com`;
  const username = `reg_${randomUUID().slice(0, 8)}`;
  const password = 'local-test-password-123';
  const res = await customerApi.fetch(request('customer', {
    action: 'register',
    username,
    email,
    password,
    first: 'สมชาย',
    last: 'ใจดี'
  }));
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.user.firstName, 'สมชาย');
  assert.equal(data.user.lastName, 'ใจดี');
  assert.equal(data.user.name, 'สมชาย ใจดี');
  assert.equal(data.user.username, username);
  assert.equal(data.user.email, email);

  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const sessionRes = await customerApi.fetch(request('customer?view=session', undefined, cookie));
  const sessionUser = (await sessionRes.json()).user;
  assert.equal(sessionUser.firstName, 'สมชาย');
  assert.equal(sessionUser.lastName, 'ใจดี');
  assert.equal(sessionUser.name, 'สมชาย ใจดี');
});

test('order snapshot customer_name and email remain immutable after profile updates', async () => {
  const buyer = await account('immut');
  // 1. Initial profile update
  const updateRes1 = await customerApi.fetch(request('customer', {
    action: 'update-profile',
    first: 'นพดล',
    last: 'ทองคำ'
  }, buyer.cookie));
  const cookie1 = updateRes1.headers.get('set-cookie')?.split(';')[0];

  // 2. Create order with current name
  const orderRes = await ordersApi.fetch(request('orders', {
    bookId: 'media-player-pro',
    name: 'นพดล ทองคำ'
  }, cookie1));
  assert.equal(orderRes.status, 201);
  const order = (await orderRes.json()).order;
  assert.equal(order.customerName, 'นพดล ทองคำ');
  assert.equal(order.email, buyer.email);

  // 3. Buyer updates profile to a completely different name
  const updateRes2 = await customerApi.fetch(request('customer', {
    action: 'update-profile',
    first: 'วิชัย',
    last: 'เจริญกุล'
  }, cookie1));
  const cookie2 = updateRes2.headers.get('set-cookie')?.split(';')[0];
  const user2 = (await updateRes2.json()).user;
  assert.equal(user2.name, 'วิชัย เจริญกุล');

  // 4. Verify original order snapshot is still 'นพดล ทองคำ'
  const lookedUp = await orderApi.fetch(request('order', { id: order.id }, cookie2));
  assert.equal(lookedUp.status, 200);
  const lookedUpOrder = (await lookedUp.json()).order;
  assert.equal(lookedUpOrder.customerName, 'นพดล ทองคำ');
  assert.equal(lookedUpOrder.email, buyer.email);
});

