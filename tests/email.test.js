import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverEmail, emailConfigured, verifyDownloadToken } from '../lib/delivery.js';

test('placeholder sender settings do not attempt email delivery', async () => {
  const names = ['VERCEL', 'DOWNLOAD_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  process.env.VERCEL = '1';
  process.env.DOWNLOAD_SECRET = 'test-only-download-secret-with-32-characters';
  process.env.RESEND_API_KEY = 're_REPLACE_ME';
  process.env.EMAIL_FROM = 'Demo <books@YOUR_VERIFIED_DOMAIN>';
  globalThis.fetch = () => { throw new Error('Resend must not be called'); };
  try {
    assert.equal(emailConfigured(), false);
    const result = await deliverEmail({ id: 'EB-1234567890ABCDEF12345678', book_id: 'media-player-pro', email: 'buyer@example.org' }, [{ id: 'media-player-pro' }], 'https://shop.example.org');
    assert.equal(result.emailStatus, 'NOT_CONFIGURED');
    assert.ok(result.downloadUrls['media-player-pro']);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

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
    const sentPayload = JSON.parse(calls[0].body);
    assert.ok(sentPayload.html.includes('SAFEMODE SHOP'));
    assert.ok(sentPayload.html.includes('เปิด E-Book ของฉัน'));
    assert.ok(sentPayload.text.includes('SAFEMODE SHOP'));
    assert.match(sentPayload.subject, /^SAFEMODE SHOP \| E-Book ของคุณพร้อมแล้ว/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('email templates produce consistent brand voice, HTML, and text fallback', async () => {
  const {
    renderDeliveryEmail,
    renderOrderConfirmationEmail,
    renderPasswordResetEmail,
    renderOrderCancelledEmail,
    renderWelcomeEmail,
    renderVerificationEmail,
    renderAdminNotificationEmail,
    formatGreeting,
    formatGreetingText
  } = await import('../lib/email-templates.js');

  // Greeting test
  assert.equal(formatGreeting('สมชาย'), 'สวัสดีคุณ สมชาย');
  assert.equal(formatGreeting(''), 'สวัสดี');
  assert.equal(formatGreeting('null'), 'สวัสดี');
  assert.equal(formatGreeting('undefined'), 'สวัสดี');
  assert.equal(formatGreeting('Customer User'), 'สวัสดี');
  assert.equal(formatGreetingText('วิชัย'), 'สวัสดีคุณ วิชัย');
  assert.equal(formatGreetingText(''), 'สวัสดี');

  // Delivery Email (single book)
  const deliverySingle = renderDeliveryEmail(
    { id: 'EB-1234567890ABCDEF12345678', customer_name: 'ผู้ซื้อ', price: 99 },
    [{ id: 'book-1', title: 'คู่มือพัฒนาแอป', price: 99 }],
    { 'book-1': 'https://shop.example.org/api/download?token=abc' },
    'https://shop.example.org'
  );
  assert.match(deliverySingle.subject, /^SAFEMODE SHOP \| E-Book ของคุณพร้อมแล้ว #EB-1234567890ABCDEF12345678$/);
  assert.ok(deliverySingle.html.includes('สวัสดีคุณ ผู้ซื้อ'));
  assert.ok(deliverySingle.html.includes('เปิด E-Book ของฉัน'));
  assert.ok(deliverySingle.html.includes('99 บาท'));
  assert.ok(deliverySingle.text.includes('เปิด E-Book ของฉัน:'));

  // Delivery Email (multiple books)
  const deliveryMulti = renderDeliveryEmail(
    { id: 'EB-MULTI1234567890ABCDEF12', customer_name: 'นักอ่าน', price: 198 },
    [
      { id: 'b1', title: 'เล่มที่ 1', price: 99 },
      { id: 'b2', title: 'เล่มที่ 2', price: 99 }
    ],
    {
      b1: 'https://shop.example.org/api/download?token=b1',
      b2: 'https://shop.example.org/api/download?token=b2'
    },
    'https://shop.example.org'
  );
  assert.ok(deliveryMulti.html.includes('เล่มที่ 1'));
  assert.ok(deliveryMulti.html.includes('เล่มที่ 2'));
  assert.ok(deliveryMulti.html.includes('ดูคำสั่งซื้อของฉัน') || deliveryMulti.html.includes('ตรวจสอบคำสั่งซื้อทั้งหมด'));

  // Order Confirmation Email
  const confirmation = renderOrderConfirmationEmail(
    { id: 'EB-PENDING123456789012345', customer_name: 'ลูกค้า', price: 150 },
    [{ id: 'b1', title: 'หนังสือเรียน', price: 150 }],
    'https://shop.example.org'
  );
  assert.match(confirmation.subject, /^SAFEMODE SHOP \| ยืนยันคำสั่งซื้อ #EB-PENDING123456789012345$/);
  assert.ok(confirmation.html.includes('รอดำเนินการ') || confirmation.html.includes('รอการชำระเงิน'));
  assert.ok(confirmation.html.includes('ตรวจสอบคำสั่งซื้อ'));

  // Password Reset Email
  const reset = renderPasswordResetEmail({
    resetUrl: 'https://shop.example.org/#reset-password?token=secret-token',
    email: 'user@example.org',
    customerName: 'ผู้ใช้งาน'
  });
  assert.equal(reset.subject, 'SAFEMODE SHOP | รีเซ็ตรหัสผ่านของคุณ');
  assert.ok(reset.html.includes('ตั้งรหัสผ่านใหม่'));
  assert.ok(!reset.html.includes('undefined'));

  // Order Cancelled Email
  const cancelled = renderOrderCancelledEmail(
    { id: 'EB-CANCEL1234567890123456', customer_name: 'ลูกค้า' },
    'https://shop.example.org'
  );
  assert.match(cancelled.subject, /^SAFEMODE SHOP \| คำสั่งซื้อ #EB-CANCEL1234567890123456 ถูกยกเลิก$/);
  assert.ok(cancelled.html.includes('ยกเลิกแล้ว'));

  // Welcome Email
  const welcome = renderWelcomeEmail({ customerName: 'สมาชิกใหม่' });
  assert.equal(welcome.subject, 'ยินดีต้อนรับสู่ SAFEMODE SHOP');
  assert.ok(welcome.html.includes('เลือกดู E-Book'));

  // Verification Email
  const verification = renderVerificationEmail({
    verifyUrl: 'https://shop.example.org/verify?token=xyz',
    email: 'new@example.org',
    customerName: 'สมาชิกใหม่'
  });
  assert.equal(verification.subject, 'SAFEMODE SHOP | ยืนยันอีเมลของคุณ');
  assert.ok(verification.html.includes('ยืนยันอีเมล'));

  // Admin Notification Email
  const adminNote = renderAdminNotificationEmail({
    title: 'New Order',
    message: 'มีคำสั่งซื้อใหม่เข้าระบบ',
    order: { id: 'EB-1234', customer_name: 'ทดสอบ', email: 'test@test.com', status: 'PAID' }
  });
  assert.equal(adminNote.subject, 'SAFEMODE SHOP Admin | New Order');
  assert.ok(adminNote.html.includes('มีคำสั่งซื้อใหม่เข้าระบบ'));
});

