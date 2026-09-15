import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isLocalDemo } from './store.js';
import { renderDeliveryEmail } from './email-templates.js';

const localSecret = crypto.randomUUID() + crypto.randomUUID();

function secret() {
  if (isLocalDemo()) return localSecret;
  const value = process.env.DOWNLOAD_SECRET;
  if (!value || value.length < 32 || value.includes('REPLACE')) {
    throw Object.assign(new Error('ยังไม่ได้ตั้งค่า DOWNLOAD_SECRET'), { status: 503 });
  }
  return value;
}

export function makeDownloadToken(order, bookId = order.book_id, expiresAt = Math.floor(Date.now() / 1000) + 86400) {
  const payload = Buffer.from(JSON.stringify({ id: order.id, bookId, exp: expiresAt })).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyDownloadToken(token) {
  if (typeof token !== 'string' || token.length > 500) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest();
  let given;
  try { given = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() / 1000 && /^EB-[A-F0-9]{24}$/.test(data.id) && /^[a-z0-9-]+$/.test(data.bookId)
      ? { id: data.id, bookId: data.bookId } : null;
  } catch { return null; }
}

export function downloadUrl(order, origin, bookId = order.book_id, expiresAt) {
  return `${origin}/api/download?token=${encodeURIComponent(makeDownloadToken(order, bookId, expiresAt))}`;
}

export function emailConfigured() {
  const key = process.env.RESEND_API_KEY || '';
  const from = process.env.EMAIL_FROM || '';
  const address = from.match(/<([^<>]+)>$/)?.[1] || from;
  return key.startsWith('re_') && !/REPLACE|YOUR_/i.test(key) &&
    /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) && !/REPLACE|YOUR_/i.test(from);
}

export async function deliverEmail(order, books, origin) {
  const items = Array.isArray(books) ? books : [books];
  // Keep retry payloads identical for five minutes so Resend can deduplicate them.
  const sendSlot = Math.floor(Date.now() / 300000);
  const expiresAt = (sendSlot + 1) * 300 + 86400;
  const downloadUrls = Object.fromEntries(items.map(book => [book.id, downloadUrl(order, origin, book.id, expiresAt)]));
  if (isLocalDemo()) return { emailStatus: 'DEMO', downloadUrls };
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!emailConfigured()) {
    return { emailStatus: 'NOT_CONFIGURED', downloadUrls };
  }
  const emailData = renderDeliveryEmail(order, items, downloadUrls, origin);
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `paid-${order.id}-${sendSlot}` },
      body: JSON.stringify({
        from,
        to: [order.email],
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      })
    });
  } catch (error) {
    console.error('Resend delivery request failed', error.name);
    return { emailStatus: 'FAILED', downloadUrls };
  }
  if (!response.ok) {
    console.error('Resend delivery failed', response.status);
    return { emailStatus: 'FAILED', downloadUrls };
  }
  return { emailStatus: 'SENT', downloadUrls };
}

export function resolveMimeType(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  const types = {
    '.pdf': 'application/pdf',
    '.epub': 'application/epub+zip',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.zip': 'application/zip',
    '.mobi': 'application/x-mobipocket-ebook',
    '.azw3': 'application/vnd.amazon.ebook',
    '.txt': 'text/plain; charset=utf-8'
  };
  return types[ext] || 'application/octet-stream';
}

export async function localBookBytes(book) {
  return readFile(path.join(process.cwd(), 'private-books', book.file));
}

export async function signedBookUrl(book) {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SECRET_KEY;
  const bucket = 'ebooks';
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${base}/storage/v1/object/sign/${bucket}/${encodeURIComponent(book.file)}`, {
    method: 'POST', headers, body: JSON.stringify({ expiresIn: 300 })
  });
  if (!response.ok) throw Object.assign(new Error(`Storage signing failed: ${response.status}`), { status: 500 });
  const data = await response.json();
  const signed = data.signedURL || data.signedUrl;
  if (!signed) throw Object.assign(new Error('Storage did not return a signed URL'), { status: 500 });
  const url = new URL(signed.startsWith('/object/') ? `${base}/storage/v1${signed}` : signed, base);
  url.searchParams.set('download', book.file);
  return url.toString();
}
