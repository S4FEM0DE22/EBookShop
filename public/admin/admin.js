const app = document.querySelector('#app');
let data = { books: [], orders: [], emailConfigured: false };
let view = 'overview';
let query = '';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const formatDate = value => value ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const statusText = status => ({ PENDING: 'รอชำระ', PAID: 'ชำระแล้ว', CANCELLED: 'ยกเลิกแล้ว' })[status] || status;
const emailText = status => ({ SENT: 'ส่งอีเมลแล้ว', FAILED: 'ส่งไม่สำเร็จ', NOT_CONFIGURED: 'ยังไม่ตั้งค่าอีเมล', DEMO: 'โหมดสาธิต', NOT_SENT: 'ยังไม่ส่ง' })[status] || status;

async function api(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, { credentials: 'same-origin', cache: 'no-store', ...options });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'ระบบขัดข้อง'), { status: response.status });
  return result;
}
const post = input => api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });

function toast(message, bad = false) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = `toast${bad ? ' bad' : ''}`;
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 4000);
}

function renderLogin(configured = true) {
  app.innerHTML = `<div class="login"><div class="login-brand"><img src="/assets/safe-mode-shop-white.png" alt="SAFE MODE SHOP"><div><span class="eyebrow">ADMIN WORKSPACE</span><h1>จัดการร้าน<br>ได้ในที่เดียว</h1><p>ดูคำสั่งซื้อ ติดตามการส่ง E-book และจัดการหนังสือในหน้าหลังบ้านเฉพาะผู้ดูแล</p></div><span>SAFE MODE SHOP · DEMO</span></div><div class="login-panel"><form class="login-card" id="login-form"><span class="eyebrow">SECURE ACCESS</span><h2>เข้าสู่ระบบผู้ดูแล</h2><p class="muted">ใช้รหัสผ่านผู้ดูแลเพื่อเปิดแดชบอร์ด</p><label for="password">รหัสผ่าน</label><input class="field" id="password" type="password" autocomplete="current-password" required autofocus><button class="primary" type="submit">เข้าสู่หลังบ้าน →</button><div class="error" id="login-error" role="alert">${configured ? '' : 'ยังไม่ได้ตั้งค่ารหัสผู้ดูแลบนเซิร์ฟเวอร์'}</div><a class="back" href="/">← กลับหน้าร้าน</a></form></div></div>`;
  document.querySelector('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    document.querySelector('#login-error').textContent = '';
    try {
      await post({ action: 'login', password: document.querySelector('#password').value });
      document.querySelector('#password').value = '';
      await load();
    } catch (error) { document.querySelector('#login-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
}

function metrics() {
  const pending = data.orders.filter(order => order.status === 'PENDING').length;
  const paid = data.orders.filter(order => order.status === 'PAID').length;
  const active = data.books.filter(book => book.active).length;
  return `<div class="metrics"><div class="metric"><span>คำสั่งซื้อทั้งหมด</span><strong>${data.orders.length}</strong><small>รายการล่าสุดสูงสุด 100 รายการ</small></div><div class="metric alert"><span>รอชำระ</span><strong>${pending}</strong><small>ระบบชำระเงินจำลอง</small></div><div class="metric"><span>ชำระแล้ว</span><strong>${paid}</strong><small>พร้อมดาวน์โหลด E-book</small></div><div class="metric"><span>หนังสือที่เปิดขาย</span><strong>${active}</strong><small>จากทั้งหมด ${data.books.length} เล่ม</small></div></div>`;
}

function orderTable(limit) {
  const filtered = data.orders.filter(order => `${order.id} ${order.customerName} ${order.email}`.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
  if (!filtered.length) return `<div class="empty">${query ? 'ไม่พบคำสั่งซื้อที่ค้นหา' : 'ยังไม่มีคำสั่งซื้อ'}</div>`;
  return `<div class="table-wrap"><table class="orders"><thead><tr><th>คำสั่งซื้อ</th><th>ลูกค้า</th><th>หนังสือ</th><th>สถานะ</th><th>อีเมล</th><th>วันที่</th><th>จัดการ</th></tr></thead><tbody>${filtered.map(order => `<tr><td><strong>${escapeHtml(order.id)}</strong><small>${order.price} บาท</small></td><td><strong>${escapeHtml(order.customerName)}</strong><small>${escapeHtml(order.email)}</small></td><td>${order.items.map(item => escapeHtml(item.title)).join('<br>') || '—'}</td><td><span class="pill ${order.status.toLowerCase()}">${statusText(order.status)}</span></td><td><span class="pill neutral">${emailText(order.emailStatus)}</span></td><td>${formatDate(order.createdAt)}</td><td>${order.status === 'PENDING' ? `<button class="mini" data-action="mark-paid" data-id="${escapeHtml(order.id)}">จำลองชำระ</button><button class="mini danger" data-action="cancel-order" data-id="${escapeHtml(order.id)}">ยกเลิก</button>` : order.status === 'PAID' && order.emailStatus !== 'SENT' && data.emailConfigured ? `<button class="mini" data-action="retry-email" data-id="${escapeHtml(order.id)}">ลองส่งอีเมล</button>` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}

function booksPanel() {
  return `<section class="panel"><div class="panel-head"><div><h2>จัดการหนังสือ</h2><p>เปิดหรือซ่อนหนังสือจากหน้าร้าน</p></div></div><div class="catalog-grid">${data.books.map(book => `<article class="book"><img src="${escapeHtml(book.cover)}" alt=""><div><h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.subtitle)}</p><strong>${book.price} บาท</strong><span class="pill ${book.active ? 'paid' : 'cancelled'}">${book.active ? 'เปิดขาย' : 'ซ่อนจากร้าน'}</span><br><button class="mini" data-action="set-book-active" data-id="${escapeHtml(book.id)}" data-active="${!book.active}">${book.active ? 'ซ่อนหนังสือ' : 'เปิดขาย'}</button></div></article>`).join('')}</div></section>`;
}

function render() {
  const title = { overview: 'ภาพรวมร้าน', orders: 'คำสั่งซื้อ', books: 'หนังสือ' }[view];
  app.innerHTML = `<div class="layout"><aside class="sidebar"><div class="logo"><img src="/assets/safe-mode-shop-white.png" alt="SAFE MODE SHOP"><small>ADMIN WORKSPACE</small></div><nav class="side-nav" aria-label="เมนูผู้ดูแล"><button data-view="overview" class="${view === 'overview' ? 'active' : ''}">▦ &nbsp; ภาพรวม</button><button data-view="orders" class="${view === 'orders' ? 'active' : ''}">▤ &nbsp; คำสั่งซื้อ</button><button data-view="books" class="${view === 'books' ? 'active' : ''}">▧ &nbsp; หนังสือ</button></nav><div class="side-bottom"><a href="/">↗ &nbsp; เปิดหน้าร้าน</a><button data-action="logout">⇥ &nbsp; ออกจากระบบ</button></div></aside><main class="main"><header class="topbar"><div><span class="eyebrow">SAFE MODE SHOP / ADMIN</span><h1>${title}</h1><p>จัดการร้าน E-book และติดตามคำสั่งซื้อ</p></div><span class="badge"><i></i>ระบบสาธิต</span></header><div class="notice">การชำระเงินบนเว็บไซต์นี้เป็นเพียงการจำลอง ไม่มีการรับเงินจริง</div>${view === 'overview' ? `${metrics()}<section class="panel"><div class="panel-head"><div><h2>คำสั่งซื้อล่าสุด</h2><p>5 รายการล่าสุด</p></div><button class="mini" data-view="orders">ดูทั้งหมด →</button></div>${orderTable(5)}</section>` : view === 'orders' ? `<section class="panel"><div class="panel-head"><div><h2>รายการคำสั่งซื้อทั้งหมด</h2><p>แสดงสูงสุด 100 รายการล่าสุด</p></div><input class="field search" id="order-search" type="search" placeholder="ค้นหาเลขคำสั่งซื้อ ชื่อ หรืออีเมล" value="${escapeHtml(query)}" aria-label="ค้นหาคำสั่งซื้อ"></div><div id="order-results">${orderTable(100)}</div></section>` : booksPanel()}</main></div>`;
  document.querySelector('#order-search')?.addEventListener('input', event => {
    query = event.target.value;
    document.querySelector('#order-results').innerHTML = orderTable(100);
  });
}

async function load() {
  data = await api('?view=overview');
  render();
}

app.addEventListener('click', async event => {
  const target = event.target.closest('[data-view], [data-action]');
  if (!target) return;
  if (target.dataset.view) { view = target.dataset.view; render(); return; }
  const action = target.dataset.action;
  target.disabled = true;
  try {
    if (action === 'logout') { await post({ action }); renderLogin(); return; }
    const input = { action, id: target.dataset.id };
    if (action === 'set-book-active') input.active = target.dataset.active === 'true';
    await post(input);
    await load();
    toast(action === 'set-book-active' ? 'อัปเดตหน้าร้านแล้ว' : action === 'cancel-order' ? 'ยกเลิกคำสั่งซื้อแล้ว' : action === 'mark-paid' ? 'บันทึกการชำระเงินจำลองแล้ว' : 'ดำเนินการส่งอีเมลแล้ว');
  } catch (error) { toast(error.message, true); if (error.status === 401) renderLogin(); }
  finally { target.disabled = false; }
});

try {
  const session = await api('?view=session');
  if (session.authenticated) await load(); else renderLogin(session.configured);
} catch (error) { renderLogin(); toast(error.message, true); }
