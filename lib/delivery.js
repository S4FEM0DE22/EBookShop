import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isLocalDemo } from './store.js';

const localSecret = crypto.randomUUID() + crypto.randomUUID();

function secret() {
  if (isLocalDemo()) return localSecret;
  const value = process.env.DOWNLOAD_SECRET;
  if (!value || value.length < 32 || value.includes('REPLACE')) {
    throw Object.assign(new Error('ยังไม่ได้ตั้งค่า DOWNLOAD_SECRET'), { status: 503 });
  }
  return value;
}

export function makeDownloadToken(order) {
  const payload = Buffer.from(JSON.stringify({ id: order.id, exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
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
    return data.exp > Date.now() / 1000 && /^EB-[A-F0-9]{24}$/.test(data.id) ? data.id : null;
  } catch { return null; }
}

export function downloadUrl(order, origin) {
  return `${origin}/api/download?token=${encodeURIComponent(makeDownloadToken(order))}`;
}

export async function deliverEmail(order, book, origin) {
  const url = downloadUrl(order, origin);
  if (isLocalDemo()) return { emailStatus: 'DEMO', downloadUrl: url };
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || key.includes('REPLACE') || from.includes('YOUR_VERIFIED_DOMAIN')) {
    return { emailStatus: 'NOT_CONFIGURED', downloadUrl: url };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `paid-${order.id}` },
    body: JSON.stringify({
      from,
      to: [order.email],
      subject: `ลิงก์ดาวน์โหลด ${book.title} (Demo)`,
      text: `สวัสดี ${order.customer_name}\n\nคำสั่งซื้อ ${order.id} มีสถานะ PAID (การชำระเงินจำลอง)\nดาวน์โหลด E-book ภายใน 24 ชั่วโมง: ${url}\n\nลิงก์ไฟล์จริงมีอายุ 5 นาทีหลังเปิดลิงก์นี้\nDEMO ONLY - ไม่มีการรับเงินจริง`
    })
  });
  if (!response.ok) {
    console.error('Resend delivery failed', response.status, await response.text());
    return { emailStatus: 'FAILED', downloadUrl: url };
  }
  return { emailStatus: 'SENT', downloadUrl: url };
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
