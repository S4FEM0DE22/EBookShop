import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { books } from './catalog.js';

const localFile = path.join(process.cwd(), '.data', 'orders.json');
const localBooksFile = path.join(process.cwd(), '.data', 'book-visibility.json');
let localQueue = Promise.resolve();
let localBooksQueue = Promise.resolve();

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

export async function updateOrder(id, changes, expectedStatus) {
  if (isLocalDemo()) return withLocalWrite(orders => {
    const order = orders.find(item => item.id === id);
    if (!order || (expectedStatus && order.status !== expectedStatus)) return null;
    Object.assign(order, changes);
    return order;
  });
  const statusFilter = expectedStatus ? `&status=eq.${encodeURIComponent(expectedStatus)}` : '';
  return (await supabase('orders', 'PATCH', `?id=eq.${encodeURIComponent(id)}${statusFilter}`, changes))[0] || null;
}

export async function listBooks() {
  if (isLocalDemo()) return (await listAllBooks()).filter(book => book.active);
  return supabase('books', 'GET', '?select=*&active=eq.true&order=id.asc');
}

export async function getBook(id) {
  if (isLocalDemo()) return (await listAllBooks()).find(book => book.id === id) || null;
  const rows = await supabase('books', 'GET', `?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function listAllBooks() {
  if (!isLocalDemo()) return supabase('books', 'GET', '?select=*&order=id.asc');
  let visibility = {};
  try { visibility = JSON.parse(await readFile(localBooksFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return books.map(book => ({ ...book, active: visibility[book.id] !== false }));
}

export async function setBookActive(id, active) {
  if (!isLocalDemo()) return (await supabase('books', 'PATCH', `?id=eq.${encodeURIComponent(id)}`, { active }))[0] || null;
  const work = localBooksQueue.then(async () => {
    const book = books.find(item => item.id === id);
    if (!book) return null;
    let visibility = {};
    try { visibility = JSON.parse(await readFile(localBooksFile, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    visibility[id] = active;
    await mkdir(path.dirname(localBooksFile), { recursive: true });
    await writeFile(localBooksFile, JSON.stringify(visibility, null, 2));
    return { ...book, active };
  });
  localBooksQueue = work.catch(() => {});
  return work;
}

export async function listOrders(limit = 100) {
  if (isLocalDemo()) return (await localRead()).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  return supabase('orders', 'GET', `?select=*&order=created_at.desc&limit=${limit}`);
}

export async function listCustomerOrders(email) {
  if (isLocalDemo()) return (await localRead()).filter(order => order.email === email).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return supabase('orders', 'GET', `?email=eq.${encodeURIComponent(email)}&select=*&order=created_at.desc&limit=100`);
}

export async function getOrderBooks(order) {
  const ids = Array.isArray(order.book_ids) && order.book_ids.length ? order.book_ids : [order.book_id];
  return (await Promise.all(ids.map(getBook))).filter(Boolean);
}
