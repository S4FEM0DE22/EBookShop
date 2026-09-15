import path from 'node:path';
import * as mupdf from 'mupdf';

export const DEFAULT_COVER = '/assets/covers/default-book-cover.svg';
export const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
export const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function inferCoverMode(cover) {
  if (!cover || cover === DEFAULT_COVER) return 'default';
  if (cover.includes('-auto.')) return 'auto_first_page';
  return 'custom';
}

export async function extractPdfFirstPage(buffer) {
  try {
    if (!buffer || buffer.length < 4) return null;
    const doc = mupdf.Document.openDocument(buffer, 'application/pdf');
    if (!doc || doc.countPages() < 1) return null;
    const page = doc.loadPage(0);
    const bounds = page.getBounds();
    const width = bounds[2] - bounds[0];
    const scale = width > 0 ? Math.min(2.0, Math.max(0.4, 600 / width)) : 1.0;
    const matrix = mupdf.Matrix.scale(scale, scale);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB);
    const pngBuffer = Buffer.from(pixmap.asPNG());
    return pngBuffer;
  } catch {
    return null;
  }
}

export function validateCustomCoverFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('กรุณาเลือกไฟล์รูปหน้าปก');
  }
  if (file.size <= 0) throw new Error('ไฟล์รูปหน้าปกว่างเปล่า');
  if (file.size > 5242880) throw new Error('ไฟล์รูปหน้าปกมีขนาดใหญ่เกิน 5MB');
  const ext = path.extname(file.name || '').toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.has(ext)) {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ .jpg, .jpeg, .png, .webp');
  }
  return ext;
}
