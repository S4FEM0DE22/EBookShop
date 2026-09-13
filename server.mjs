import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const routes = new Map([
  ['/api/books', () => import('./api/books.js')],
  ['/api/orders', () => import('./api/orders.js')],
  ['/api/order', () => import('./api/order.js')],
  ['/api/pay', () => import('./api/pay.js')],
  ['/api/cancel', () => import('./api/cancel.js')],
  ['/api/download', () => import('./api/download.js')],
  ['/api/admin', () => import('./api/admin.js')]
]);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let response;
    if (routes.has(url.pathname)) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
      response = await (await routes.get(url.pathname)()).default.fetch(request);
    } else {
      const safePath = url.pathname === '/' ? '/index.html' : url.pathname === '/admin/' || url.pathname === '/admin' ? '/admin/index.html' : url.pathname;
      if (!/^\/[a-zA-Z0-9_./-]+$/.test(safePath) || safePath.includes('..') || safePath.startsWith('/private-books') || safePath.startsWith('/lib')) {
        res.writeHead(404).end(); return;
      }
      try {
        const bytes = await readFile(path.join(root, 'public', safePath));
        response = new Response(bytes, { headers: { 'Content-Type': types[path.extname(safePath)] || 'application/octet-stream' } });
      } catch { response = new Response('Not found', { status: 404 }); }
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end('Server error');
  }
}).listen(Number(process.env.PORT || 3000), () => console.log(`Demo E-book Shop: http://localhost:${process.env.PORT || 3000}`));
