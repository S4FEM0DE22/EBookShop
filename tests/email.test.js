import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverEmail, verifyDownloadToken } from '../lib/delivery.js';

test('email outage preserves download access and a retry reuses the same request', async () => {
  const names = ['VERCEL', 'DOWNLOAD_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const calls = [];
  process.env.VERCEL = '1';
  process.env.DOWNLOAD_SECRET = 'test-only-download-secret-with-32-characters';
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.EMAIL_FROM = 'Demo <books@example.org>';
  console.error = () => {};
  globalThis.fetch = async (url, options) => {
    calls.push({ url, key: options.headers['Idempotency-Key'], body: options.body });
    if (calls.length === 1) throw new TypeError('temporary network failure');
    return Response.json({ id: 'email-test' });
  };
  try {
    const order = {
      id: 'EB-1234567890ABCDEF12345678',
      book_id: 'media-player-pro',
      customer_name: 'ผู้ทดสอบ',
      email: 'buyer@example.org'
    };
    const books = [{ id: 'media-player-pro', title: 'Media Player PRO' }];
    const first = await deliverEmail(order, books, 'https://shop.example.org');
    assert.equal(first.emailStatus, 'FAILED');
    assert.equal(verifyDownloadToken(new URL(first.downloadUrls['media-player-pro']).searchParams.get('token')).id, order.id);
    const retry = await deliverEmail(order, books, 'https://shop.example.org');
    assert.equal(retry.emailStatus, 'SENT');
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(calls[0].url, 'https://api.resend.com/emails');
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
