import test from 'node:test';
import assert from 'node:assert/strict';
import adminApi from '../api/admin.js';

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
    assert.equal((await adminApi.fetch(request('?view=overview', undefined, `${cookie}tampered`))).status, 401);

    const logout = await adminApi.fetch(request('', { action: 'logout' }, cookie));
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previous;
  }
});
