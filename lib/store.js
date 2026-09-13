import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { books } from './catalog.js';

const localFile = path.join(process.cwd(), '.data', 'orders.json');
let localQueue = Promise.resolve();

export function isLocalDemo() {
  return !process.env.VERCEL && !process.env.SUPABASE_URL && !process.env.SUPABASE_SECRET_KEY;
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || url.includes('YOUR_PROJECT') || key.includes('REPLACE_ME')) {
    throw Object.assign(new Error('ยังไม่ได้ตั้งค่า Supabase'), { status: 503 });
  }
  return { url: url.replace(/\/$/, ''), key };
}

async function supabase(table, method, query = '', payload) {
  const { url, key } = config();
  const headers = { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const result = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
    cache: 'no-store'
  });
  if (!result.ok) throw Object.assign(new Error(`Supabase ${result.status}: ${await result.text()}`), { status: 500 });
  return result.json();
}

async function localRead() {
  try { return JSON.parse(await readFile(localFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function localWrite(orders) {
  await mkdir(path.dirname(localFile), { recursive: true });
  await writeFile(localFile, JSON.stringify(orders, null, 2));
}

async function withLocalWrite(action) {
  const work = localQueue.then(async () => {
    const orders = await localRead();
    const result = action(orders);
    await localWrite(orders);
    return result;
  });
  localQueue = work.catch(() => {});
  return work;
}

export async function createOrder(order) {
  if (isLocalDemo()) return withLocalWrite(orders => { orders.push(order); return order; });
  return (await supabase('orders', 'POST', '', order))[0];
}

export async function getOrder(id) {
  if (isLocalDemo()) return (await localRead()).find(order => order.id === id) || null;
  const rows = await supabase('orders', 'GET', `?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function updateOrder(id, changes) {
  if (isLocalDemo()) return withLocalWrite(orders => {
    const order = orders.find(item => item.id === id);
    if (!order) return null;
    Object.assign(order, changes);
    return order;
  });
  return (await supabase('orders', 'PATCH', `?id=eq.${encodeURIComponent(id)}`, changes))[0] || null;
}

export async function listBooks() {
  if (isLocalDemo()) return books;
  return supabase('books', 'GET', '?select=*&order=id.asc');
}

export async function getBook(id) {
  if (isLocalDemo()) return books.find(book => book.id === id) || null;
  const rows = await supabase('books', 'GET', `?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function getOrderBooks(order) {
  const ids = Array.isArray(order.book_ids) && order.book_ids.length ? order.book_ids : [order.book_id];
  const catalog = await listBooks();
  return ids.map(id => catalog.find(book => book.id === id)).filter(Boolean);
}
