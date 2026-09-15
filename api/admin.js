import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { adminConfigured, clearSessionCookie, correctPassword, isAdmin, sessionCookie } from '../lib/admin-auth.js';
import { listCustomerProfiles } from '../lib/customer-auth.js';
import { emailConfigured } from '../lib/delivery.js';
import { body, fail, json, orderView } from '../lib/http.js';
import { DEFAULT_COVER, extractPdfFirstPage, inferCoverMode, validateCustomCoverFile } from '../lib/cover.js';
import { createBook, deleteBook, deleteCoverFile, deleteEbookFile, getBook, getEbookBuffer, getOrder, listAllBooks, listOrders, setBookActive, updateBookDetails, uploadCoverFile, uploadEbookFile } from '../lib/store.js';
import payApi from './pay.js';
import cancelApi from './cancel.js';

const defaultBookFiles = new Set(['media-player-pro.pdf', 'sqlite-task-manager-guide.pdf', 'sqlite-task-manager-report.pdf', 'tarot-app.pdf']);
const defaultCovers = new Set([
  DEFAULT_COVER,
  '/assets/covers/media-player-pro.jpg',
  '/assets/covers/sqlite-task-manager-guide.jpg',
  '/assets/covers/sqlite-task-manager-report.jpg',
  '/assets/covers/tarot-app.jpg'
]);
const allowedExts = new Set(['.pdf', '.epub', '.docx', '.zip', '.mobi', '.txt']);

function isDefaultCover(cover) {
  if (!cover || typeof cover !== 'string') return true;
  return defaultCovers.has(cover) || (cover.startsWith('/assets/covers/') && !cover.startsWith('/assets/covers/uploads/'));
}

function reply(data, status = 200, cookie) {
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (cookie) headers['Set-Cookie'] = cookie;
  return Response.json(data, { status, headers });
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw Object.assign(new Error('คำขอไม่ได้มาจากเว็บไซต์นี้'), { status: 403 });
}

function requireAdmin(request) {
  if (!isAdmin(request)) throw Object.assign(new Error('กรุณาเข้าสู่ระบบผู้ดูแล'), { status: 401 });
}

function validateUploadedFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('กรุณาเลือกไฟล์ E-Book');
  if (file.size <= 0) throw new Error('ไฟล์ E-Book ว่างเปล่า');
  if (file.size > 52428800) throw new Error('ไฟล์ E-Book มีขนาดใหญ่เกิน 50MB');
  const ext = path.extname(file.name || '').toLowerCase();
  if (!allowedExts.has(ext)) throw new Error('รองรับเฉพาะไฟล์ .pdf, .epub, .docx, .zip');
  return ext;
}

function makeSlug(title, id) {
  if (typeof id === 'string' && /^[a-z0-9-]{3,80}$/.test(id.trim())) {
    return id.trim().toLowerCase();
  }
  let slug = (title || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length < 3) slug = 'book-' + randomBytes(4).toString('hex');
  return slug.slice(0, 60);
}

async function changeOrder(request, input) {
  if (!['mark-paid', 'cancel-order', 'retry-email'].includes(input.action) || typeof input.id !== 'string' || !/^EB-[A-F0-9]{24}$/.test(input.id)) {
    throw new Error('คำสั่งไม่ถูกต้อง');
  }
  const order = await getOrder(input.id);
  if (!order) throw Object.assign(new Error('ไม่พบคำสั่งซื้อ'), { status: 404 });
  if (input.action === 'mark-paid' && order.status !== 'PENDING') throw Object.assign(new Error('รายการนี้ไม่รอชำระเงินแล้ว'), { status: 409 });
  if (input.action === 'cancel-order' && order.status !== 'PENDING') throw Object.assign(new Error('ยกเลิกได้เฉพาะรายการที่รอชำระเงิน'), { status: 409 });
  if (input.action === 'retry-email' && order.status !== 'PAID') throw Object.assign(new Error('ส่งอีเมลได้หลังชำระเงินเท่านั้น'), { status: 409 });
  const handler = input.action === 'cancel-order' ? cancelApi : payApi;
  const response = await handler.fetch(new Request(new URL(input.action === 'cancel-order' ? '/api/cancel' : '/api/pay', request.url), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') || '' }, body: JSON.stringify({ id: order.id, forceEmail: true, action: input.action })
  }));
  return reply(await response.json(), response.status);
}

export default { async fetch(request) {
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      if (url.searchParams.get('view') === 'session') return json({ authenticated: isAdmin(request), configured: adminConfigured() });
      requireAdmin(request);
      if (url.searchParams.get('view') !== 'overview') throw Object.assign(new Error('ไม่พบข้อมูล'), { status: 404 });
      const [books, orders, customers] = await Promise.all([listAllBooks(), listOrders(), listCustomerProfiles()]);
      const bookMap = new Map(books.map(book => [book.id, book]));
      return json({
        books: books.map(({ file, ...book }) => ({ ...book, fileName: file, coverMode: inferCoverMode(book.cover) })),
        orders: orders.map(order => orderView(order, (Array.isArray(order.book_ids) && order.book_ids.length ? order.book_ids : [order.book_id]).map(id => bookMap.get(id)).filter(Boolean))),
        customers: customers.map(item => ({
          username: item.username,
          email: item.email,
          name: item.name || '',
          firstName: item.firstName || '',
          lastName: item.lastName || '',
          createdAt: item.created_at
        })),
        emailConfigured: emailConfigured()
      });
    }
    if (request.method !== 'POST') throw Object.assign(new Error('Method not allowed'), { status: 405 });
    sameOrigin(request);
    const input = await body(request);
    if (input.action === 'login') {
      if (!adminConfigured()) throw Object.assign(new Error('ยังไม่ได้ตั้งค่ารหัสผู้ดูแล'), { status: 503 });
      if (!correctPassword(input.password)) return json({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
      return reply({ authenticated: true }, 200, sessionCookie(request));
    }
    requireAdmin(request);
    if (input.action === 'logout') return reply({ authenticated: false }, 200, clearSessionCookie(request));
    if (input.action === 'set-book-active') {
      if (typeof input.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.id)) throw new Error('ข้อมูลหนังสือไม่ถูกต้อง');
      const active = input.active === true || input.active === 'true';
      const book = await setBookActive(input.id, active);
      if (!book) throw Object.assign(new Error('ไม่พบหนังสือ'), { status: 404 });
      return json({ book: { id: book.id, active: book.active } });
    }
    if (input.action === 'add-book') {
      const title = typeof input.title === 'string' ? input.title.trim() : '';
      const subtitle = typeof input.subtitle === 'string' ? input.subtitle.trim() : '';
      const description = typeof input.description === 'string' ? input.description.trim() : '';
      const author = typeof input.author === 'string' ? input.author.trim() : '';
      const price = Number(input.price);

      if (title.length < 3 || title.length > 140 || subtitle.length < 3 || subtitle.length > 180 || description.length < 10 || description.length > 1000 || author.length < 2 || author.length > 100 || !Number.isInteger(price) || price < 1 || price > 100000) {
        return json({ error: 'กรุณากรอกข้อมูลหนังสือและราคาให้ถูกต้อง' }, 400);
      }

      const ext = validateUploadedFile(input.file);
      let slug = makeSlug(title, input.id);
      const existing = await getBook(slug);
      if (existing) slug = `${slug}-${randomBytes(2).toString('hex')}`;

      const safeFileName = `${slug}-${Date.now()}${ext}`;
      const buffer = Buffer.from(await input.file.arrayBuffer());
      await uploadEbookFile({ filename: safeFileName, buffer, mimeType: input.file.type });

      let cover = DEFAULT_COVER;
      const coverMode = typeof input.cover_mode === 'string' && input.cover_mode.trim() ? input.cover_mode.trim() : 'auto_first_page';
      let notice = null;
      let createdCoverFile = null;

      if (coverMode === 'custom') {
        try {
          const imgExt = validateCustomCoverFile(input.cover_file);
          const imgBuffer = Buffer.from(await input.cover_file.arrayBuffer());
          const coverFileName = `${slug}-${Date.now()}-custom${imgExt}`;
          const res = await uploadCoverFile({ filename: coverFileName, buffer: imgBuffer, mimeType: input.cover_file.type || 'image/jpeg' });
          cover = res.path;
          createdCoverFile = res.path;
        } catch (err) {
          await deleteEbookFile(safeFileName);
          return json({ error: err.message || 'ไม่สามารถอัปโหลดรูปหน้าปกได้' }, 400);
        }
      } else if (coverMode === 'default') {
        cover = DEFAULT_COVER;
      } else {
        // auto_first_page
        if (ext === '.pdf') {
          const pageImg = await extractPdfFirstPage(buffer);
          if (pageImg) {
            try {
              const coverFileName = `${slug}-${Date.now()}-auto.png`;
              const res = await uploadCoverFile({ filename: coverFileName, buffer: pageImg, mimeType: 'image/png' });
              cover = res.path;
              createdCoverFile = res.path;
            } catch {
              cover = DEFAULT_COVER;
              notice = 'ไม่สามารถบันทึกรูปหน้าปกอัตโนมัติได้ ระบบจะใช้หน้าปกเริ่มต้น';
            }
          } else {
            cover = DEFAULT_COVER;
            notice = 'ไม่สามารถดึงหน้าแรกของไฟล์ได้ ระบบจะใช้หน้าปกเริ่มต้น';
          }
        } else {
          cover = DEFAULT_COVER;
          notice = 'ไฟล์ประเภทนี้ไม่รองรับการสร้างหน้าปกอัตโนมัติ ระบบจะใช้หน้าปกเริ่มต้น';
        }
      }

      let newBook;
      try {
        newBook = await createBook({
          id: slug,
          title,
          subtitle,
          description,
          author,
          price,
          cover,
          file: safeFileName,
          active: true
        });
      } catch (err) {
        await deleteEbookFile(safeFileName);
        if (createdCoverFile) await deleteCoverFile(createdCoverFile);
        throw err;
      }

      return json({
        book: { id: newBook.id, title: newBook.title, price: newBook.price, cover: newBook.cover },
        notice
      });
    }
    if (input.action === 'update-book') {
      if (typeof input.id !== 'string') return json({ error: 'ไม่พบหนังสือ' }, 404);
      const existing = await getBook(input.id);
      if (!existing) return json({ error: 'ไม่พบหนังสือ' }, 404);

      const title = typeof input.title === 'string' ? input.title.trim() : '';
      const subtitle = typeof input.subtitle === 'string' ? input.subtitle.trim() : '';
      const description = typeof input.description === 'string' ? input.description.trim() : '';
      const author = typeof input.author === 'string' ? input.author.trim() : '';
      const price = Number(input.price);

      if (title.length < 3 || title.length > 140 || subtitle.length < 3 || subtitle.length > 180 || description.length < 10 || description.length > 1000 || author.length < 2 || author.length > 100 || !Number.isInteger(price) || price < 1 || price > 100000) {
        return json({ error: 'กรุณาตรวจข้อมูลหนังสือและราคา' }, 400);
      }

      const changes = { title, subtitle, description, author, price };

      let newFileName = null;
      let newFileBuffer = null;
      let newFileExt = null;
      if (input.file && typeof input.file.arrayBuffer === 'function' && input.file.size > 0) {
        newFileExt = validateUploadedFile(input.file);
        newFileName = `${input.id}-${Date.now()}${newFileExt}`;
        newFileBuffer = Buffer.from(await input.file.arrayBuffer());
        await uploadEbookFile({ filename: newFileName, buffer: newFileBuffer, mimeType: input.file.type });
        changes.file = newFileName;
      }

      const coverMode = typeof input.cover_mode === 'string' && input.cover_mode.trim() ? input.cover_mode.trim() : null;
      let notice = null;
      let newCoverPath = null;
      const oldCover = existing.cover;

      if (coverMode === 'default') {
        changes.cover = DEFAULT_COVER;
      } else if (coverMode === 'custom') {
        if (input.cover_file && typeof input.cover_file.arrayBuffer === 'function' && input.cover_file.size > 0) {
          const imgExt = validateCustomCoverFile(input.cover_file);
          const imgBuffer = Buffer.from(await input.cover_file.arrayBuffer());
          const coverFileName = `${input.id}-${Date.now()}-custom${imgExt}`;
          const res = await uploadCoverFile({ filename: coverFileName, buffer: imgBuffer, mimeType: input.cover_file.type || 'image/jpeg' });
          changes.cover = res.path;
          newCoverPath = res.path;
        } else {
          if (oldCover && !isDefaultCover(oldCover)) {
            changes.cover = oldCover;
          } else {
            return json({ error: 'กรุณาเลือกรูปหน้าปกสำหรับโหมดอัปโหลดหน้าปกเอง' }, 400);
          }
        }
      } else if (coverMode === 'auto_first_page') {
        if (newFileBuffer) {
          if (newFileExt === '.pdf') {
            const pageImg = await extractPdfFirstPage(newFileBuffer);
            if (pageImg) {
              const coverFileName = `${input.id}-${Date.now()}-auto.png`;
              const res = await uploadCoverFile({ filename: coverFileName, buffer: pageImg, mimeType: 'image/png' });
              changes.cover = res.path;
              newCoverPath = res.path;
            } else {
              changes.cover = DEFAULT_COVER;
              notice = 'ไม่สามารถดึงหน้าแรกของไฟล์ได้ ระบบจะใช้หน้าปกเริ่มต้น';
            }
          } else {
            changes.cover = DEFAULT_COVER;
            notice = 'ไฟล์ประเภทนี้ไม่รองรับการสร้างหน้าปกอัตโนมัติ ระบบจะใช้หน้าปกเริ่มต้น';
          }
        } else {
          const fileToRead = existing.file;
          const fileExt = path.extname(fileToRead || '').toLowerCase();
          if (fileExt === '.pdf') {
            const existingBuf = await getEbookBuffer(fileToRead);
            const pageImg = existingBuf ? await extractPdfFirstPage(existingBuf) : null;
            if (pageImg) {
              const coverFileName = `${input.id}-${Date.now()}-auto.png`;
              const res = await uploadCoverFile({ filename: coverFileName, buffer: pageImg, mimeType: 'image/png' });
              changes.cover = res.path;
              newCoverPath = res.path;
            } else {
              changes.cover = DEFAULT_COVER;
              notice = 'ไม่สามารถดึงหน้าแรกของไฟล์ได้ ระบบจะใช้หน้าปกเริ่มต้น';
            }
          } else {
            changes.cover = DEFAULT_COVER;
            notice = 'ไฟล์ประเภทนี้ไม่รองรับการสร้างหน้าปกอัตโนมัติ ระบบจะใช้หน้าปกเริ่มต้น';
          }
        }
      }

      let book;
      try {
        book = await updateBookDetails(input.id, changes);
      } catch (err) {
        if (newFileName) await deleteEbookFile(newFileName);
        if (newCoverPath) await deleteCoverFile(newCoverPath);
        throw err;
      }

      if (newFileName && existing.file && existing.file !== newFileName && !defaultBookFiles.has(existing.file)) {
        await deleteEbookFile(existing.file);
      }
      if (changes.cover && oldCover && oldCover !== changes.cover && !isDefaultCover(oldCover)) {
        await deleteCoverFile(oldCover);
      }

      return json({
        book: { id: book.id, title: book.title, subtitle: book.subtitle, description: book.description, author: book.author, price: book.price, cover: book.cover },
        notice
      });
    }
    if (input.action === 'delete-book') {
      if (typeof input.id !== 'string') return json({ error: 'ไม่พบหนังสือ' }, 404);
      const existing = await getBook(input.id);
      if (!existing) return json({ error: 'ไม่พบหนังสือ' }, 404);
      try {
        await deleteBook(input.id);
      } catch (err) {
        if (err.status === 409 || (err.message && err.message.includes('violates foreign key constraint'))) {
          return json({ error: 'ไม่สามารถลบหนังสือเล่มนี้ได้ เนื่องจากมีประวัติคำสั่งซื้ออ้างอิงอยู่ แนะนำให้ใช้ปุ่ม "ซ่อนหนังสือ" แทน' }, 409);
        }
        throw err;
      }
      if (existing.file && !defaultBookFiles.has(existing.file)) {
        await deleteEbookFile(existing.file);
      }
      if (existing.cover && !isDefaultCover(existing.cover)) {
        await deleteCoverFile(existing.cover);
      }
      return json({ success: true, id: input.id });
    }
    return changeOrder(request, input);
  } catch (error) { return fail(error); }
} };
