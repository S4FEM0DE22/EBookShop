import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { books as defaultBooks } from './catalog.js';

const localFile = path.join(process.cwd(), '.data', 'orders.json');
const localBooksFile = path.join(process.cwd(), '.data', 'book-visibility.json');
const localBookDetailsFile = path.join(process.cwd(), '.data', 'book-details.json');
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
  if (!result.ok) throw Object.assign(new Error(`Supabase ${result.status}: ${await result.text()}`), { status: result.status === 409 ? 409 : 500 });
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
const localBooksDataFile = path.join(process.cwd(), '.data', 'books.json');

async function localReadBooks() {
  try {
    return JSON.parse(await readFile(localBooksDataFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      let visibility = {};
      let details = {};
      try { visibility = JSON.parse(await readFile(localBooksFile, 'utf8')); } catch {}
      try { details = JSON.parse(await readFile(localBookDetailsFile, 'utf8')); } catch {}
      const initial = defaultBooks.map(book => ({ ...book, ...details[book.id], active: visibility[book.id] !== false }));
      await mkdir(path.dirname(localBooksDataFile), { recursive: true });
      await writeFile(localBooksDataFile, JSON.stringify(initial, null, 2));
      return initial;
    }
    throw error;
  }
}

async function localWriteBooks(list) {
  await mkdir(path.dirname(localBooksDataFile), { recursive: true });
  await writeFile(localBooksDataFile, JSON.stringify(list, null, 2));
}

async function withLocalBooksWrite(action) {
  const work = localBooksQueue.then(async () => {
    const list = await localReadBooks();
    const result = await action(list);
    await localWriteBooks(list);
    return result;
  });
  localBooksQueue = work.catch(() => {});
  return work;
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
  return localReadBooks();
}

export async function createBook(book) {
  if (isLocalDemo()) {
    return withLocalBooksWrite(list => {
      if (list.some(b => b.id === book.id)) {
        throw Object.assign(new Error('รหัสหนังสือหรือชื่อนี้มีอยู่แล้ว'), { status: 409 });
      }
      list.push(book);
      return book;
    });
  }
  const rows = await supabase('books', 'POST', '', book);
  return rows[0] || book;
}

export async function updateBookDetails(id, changes) {
  if (!isLocalDemo()) {
    const rows = await supabase('books', 'PATCH', `?id=eq.${encodeURIComponent(id)}`, changes);
    return rows[0] || null;
  }
  return withLocalBooksWrite(list => {
    const item = list.find(b => b.id === id);
    if (!item) return null;
    Object.assign(item, changes);
    return item;
  });
}

export async function setBookActive(id, active) {
  if (!isLocalDemo()) {
    const rows = await supabase('books', 'PATCH', `?id=eq.${encodeURIComponent(id)}`, { active });
    return rows[0] || null;
  }
  return withLocalBooksWrite(list => {
    const item = list.find(b => b.id === id);
    if (!item) return null;
    item.active = active;
    return item;
  });
}

export async function deleteBook(id) {
  if (!isLocalDemo()) {
    const rows = await supabase('books', 'DELETE', `?id=eq.${encodeURIComponent(id)}`);
    return rows[0] || null;
  }
  return withLocalBooksWrite(list => {
    const idx = list.findIndex(b => b.id === id);
    if (idx === -1) return null;
    const [removed] = list.splice(idx, 1);
    return removed;
  });
}

export async function uploadEbookFile({ filename, buffer, mimeType }) {
  if (isLocalDemo()) {
    const dir = path.join(process.cwd(), 'private-books');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    return { path: filename };
  }
  const { url, key } = config();
  const headers = { apikey: key, 'Content-Type': mimeType || 'application/octet-stream', 'x-upsert': 'true' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  let response = await fetch(`${url}/storage/v1/object/ebooks/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers,
    body: buffer
  });
  if (!response.ok && (response.status === 503 || response.status === 502)) {
    await new Promise(r => setTimeout(r, 300));
    response = await fetch(`${url}/storage/v1/object/ebooks/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers,
      body: buffer
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Storage upload failed (${response.status}): ${await response.text()}`), { status: 500 });
  }
  return { path: filename };
}

export async function getEbookBuffer(filename) {
  if (isLocalDemo()) {
    try {
      return await readFile(path.join(process.cwd(), 'private-books', filename));
    } catch {
      return null;
    }
  }
  const { url, key } = config();
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  try {
    const res = await fetch(`${url}/storage/v1/object/ebooks/${encodeURIComponent(filename)}`, { headers });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function uploadCoverFile({ filename, buffer, mimeType }) {
  if (isLocalDemo()) {
    const dir = path.join(process.cwd(), 'public', 'assets', 'covers', 'uploads');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buffer);
    return { path: `/assets/covers/uploads/${filename}` };
  }
  const { url, key } = config();
  const headers = { apikey: key, 'Content-Type': mimeType || 'image/png', 'x-upsert': 'true' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  let response = await fetch(`${url}/storage/v1/object/covers/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers,
    body: buffer
  });
  if (!response.ok && (response.status === 503 || response.status === 502)) {
    await new Promise(r => setTimeout(r, 300));
    response = await fetch(`${url}/storage/v1/object/covers/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers,
      body: buffer
    });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`Storage cover upload failed (${response.status}): ${await response.text()}`), { status: 500 });
  }
  return { path: `${url}/storage/v1/object/public/covers/${encodeURIComponent(filename)}` };
}

export async function deleteCoverFile(filenameOrUrl) {
  if (!filenameOrUrl || typeof filenameOrUrl !== 'string') return true;
  if (filenameOrUrl.startsWith('/assets/covers/') && !filenameOrUrl.startsWith('/assets/covers/uploads/')) {
    return true;
  }
  if (isLocalDemo()) {
    if (filenameOrUrl.startsWith('/assets/covers/uploads/')) {
      const filename = path.basename(filenameOrUrl);
      try {
        await unlink(path.join(process.cwd(), 'public', 'assets', 'covers', 'uploads', filename));
      } catch {}
    }
    return true;
  }
  const { url, key } = config();
  let filename = filenameOrUrl;
  if (filename.includes('/storage/v1/object/public/covers/')) {
    filename = filename.split('/storage/v1/object/public/covers/')[1];
  } else if (filename.includes('/storage/v1/object/covers/')) {
    filename = filename.split('/storage/v1/object/covers/')[1];
  } else {
    filename = path.basename(filenameOrUrl);
  }
  filename = decodeURIComponent(filename.split('?')[0]);
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  try {
    await fetch(`${url}/storage/v1/object/covers/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers
    });
  } catch {}
  return true;
}

export async function deleteEbookFile(filename) {
  if (isLocalDemo()) {
    try {
      await unlink(path.join(process.cwd(), 'private-books', filename));
    } catch {}
    return true;
  }
  const { url, key } = config();
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  try {
    await fetch(`${url}/storage/v1/object/ebooks/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers
    });
  } catch {}
  return true;
}

export async function listOrders(limit = 100) {
  if (isLocalDemo()) return (await localRead()).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  return supabase('orders', 'GET', `?select=*&order=created_at.desc&limit=${limit}`);
}

export async function listCustomerOrders(customerId) {
  if (isLocalDemo()) return (await localRead()).filter(order => order.customer_id === customerId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return supabase('orders', 'GET', `?customer_id=eq.${encodeURIComponent(customerId)}&select=*&order=created_at.desc&limit=100`);
}

export async function getCustomerProfileById(id) {
  const rows = await supabase('customer_profiles', 'GET', `?user_id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export async function getCustomerProfileByUsername(username) {
  const rows = await supabase('customer_profiles', 'GET', `?username=eq.${encodeURIComponent(username)}&select=*`);
  return rows[0] || null;
}

export async function listCustomerProfilesDb() {
  return supabase('customer_profiles', 'GET', '?select=user_id,username,email,created_at&order=created_at.desc&limit=100');
}

export async function setCustomerUsername(id, username) {
  const rows = await supabase('customer_profiles', 'PATCH', `?user_id=eq.${encodeURIComponent(id)}&username=is.null`, { username });
  return rows[0] || null;
}

export async function getOrderBooks(order) {
  const ids = Array.isArray(order.book_ids) && order.book_ids.length ? order.book_ids : [order.book_id];
  return (await Promise.all(ids.map(getBook))).filter(Boolean);
}
