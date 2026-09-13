const app = document.querySelector('#app');
const navHome = document.querySelector('#nav-home');
const navTrack = document.querySelector('#nav-track');
let books = [];
let currentOrder = null;
let customerEmail = '';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = amount => new Intl.NumberFormat('th-TH').format(amount) + ' บาท';
const book = id => books.find(item => item.id === id);
const cover = item => `<div class="book-cover ${esc(item.cover)}" aria-label="ปกหนังสือ ${esc(item.title)}"><span class="cover-kicker">CHAPTER & CO. / E-BOOK</span><span class="cover-title">${esc(item.title)}</span><span class="cover-line"></span></div>`;
const message = (text, kind = 'error') => `<div class="notice notice-${kind}" role="alert">${esc(text)}</div>`;
const demo = '<div class="notice notice-demo"><strong>DEMO ONLY</strong> — เป็นการสั่งซื้อและชำระเงินจำลอง ไม่มีการเก็บเงินหรือข้อมูลบัตร</div>';

async function api(path, payload) {
  const response = await fetch(`/api/${path}`, { method: payload ? 'POST' : 'GET', headers: payload ? { 'Content-Type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'ระบบขัดข้อง');
  return data;
}

function setView(html, active = '') {
  app.innerHTML = html;
  navHome.classList.toggle('active', active === 'home');
  navTrack.classList.toggle('active', active === 'track');
  window.scrollTo(0, 0);
}

function home() {
  setView(`<section class="hero"><div class="hero-inner"><div><div class="eyebrow">E-BOOK COLLECTION / 2026</div><h1>อ่านเรื่องใหม่<br>เริ่มได้ที่นี่</h1><p>เลือก E-book ที่สนใจ แล้วลองสั่งซื้อผ่านระบบสาธิตได้ทันที</p></div><div class="hero-stamp" aria-hidden="true">READ<br>CREATE<br>GROW</div></div></section><div class="container"><div class="section-head"><h2>หนังสือทั้งหมด</h2><p>${books.length} เล่ม · ไฟล์ PDF ตัวอย่าง</p></div><div class="book-grid">${books.map(item => `<article class="book-card"><div class="book-cover-wrap">${cover(item)}</div><div class="book-body"><h3>${esc(item.title)}</h3><p class="book-subtitle">${esc(item.subtitle)}</p><p class="book-description">${esc(item.description)}</p><div class="book-bottom"><span class="price">${money(item.price)}</span><a class="button" href="#book/${esc(item.id)}">ดูหนังสือ</a></div></div></article>`).join('')}</div></div>`, 'home');
}

function detail(id) {
  const item = book(id); if (!item) return notFound();
  setView(`<div class="container"><a class="back-link" href="#home">← กลับไปร้านหนังสือ</a><div class="detail-layout"><div class="detail-art">${cover(item)}</div><div class="detail-info"><div class="eyebrow">E-BOOK / PDF</div><h1>${esc(item.title)}</h1><p class="lead">${esc(item.description)}</p><div class="detail-meta"><div>ผู้จัดทำ<strong>${esc(item.author)}</strong></div><div>รูปแบบ<strong>PDF</strong></div></div>${demo}<div class="detail-actions"><span class="price">${money(item.price)}</span><a class="button button-gold" href="#checkout/${esc(item.id)}">สั่งซื้อเล่มนี้ →</a></div></div></div></div>`, 'home');
}

function checkout(id) {
  const item = book(id); if (!item) return notFound();
  setView(`<div class="narrow"><a class="back-link" href="#book/${esc(id)}">← กลับไปหน้าหนังสือ</a><div class="panel form-panel"><div class="eyebrow">CHECKOUT / 01</div><h1>ยืนยันการสั่งซื้อ</h1><p class="intro">ตรวจรายการและกรอกข้อมูลสำหรับติดตามคำสั่งซื้อ</p>${demo}<div class="summary"><div><strong>${esc(item.title)}</strong><span>ไฟล์ E-book PDF · 1 เล่ม</span></div><strong>${money(item.price)}</strong></div><form id="checkout-form"><label for="name">ชื่อผู้สั่งซื้อ</label><input id="name" name="name" autocomplete="name" minlength="2" maxlength="80" required placeholder="ชื่อของคุณ"><label for="email">อีเมลสำหรับรับหนังสือ</label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="name@example.com"><p class="field-note">ใช้ร่วมกับเลขคำสั่งซื้อเพื่อติดตามสถานะ</p><div id="live-message" aria-live="polite"></div><div class="form-actions"><button class="button" type="submit">ยืนยันคำสั่งซื้อ</button><a class="button button-secondary" href="#book/${esc(id)}">ย้อนกลับ</a></div></form></div></div>`, 'home');
  document.querySelector('#checkout-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    document.querySelector('#live-message').innerHTML = '';
    try {
      const { order } = await api('orders', { bookId: id, name: form.elements.namedItem('name').value, email: form.elements.namedItem('email').value });
      currentOrder = order; customerEmail = order.email; location.hash = `#order/${order.id}`;
    } catch (error) { document.querySelector('#live-message').innerHTML = message(error.message); button.disabled = false; }
  });
}

function orderPage(id) {
  if (!currentOrder || currentOrder.id !== id) return track(id);
  const order = currentOrder;
  const paid = order.status === 'PAID';
  const deliveryText = {
    SENT: 'ส่งอีเมลลิงก์ดาวน์โหลดแล้ว โปรดตรวจกล่องจดหมายและอีเมลขยะ',
    DEMO: 'โหมดทดสอบในเครื่อง: แสดงลิงก์ดาวน์โหลดแทนการส่งอีเมลจริง',
    FAILED: 'ส่งอีเมลไม่สำเร็จ สามารถใช้ลิงก์ดาวน์โหลดด้านล่างได้',
    NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่าบริการอีเมล สามารถใช้ลิงก์ดาวน์โหลดด้านล่างได้'
  }[order.emailStatus];
  setView(`<div class="narrow"><a class="back-link" href="#home">← กลับไปร้านหนังสือ</a><div class="panel order-panel"><div class="eyebrow">ORDER STATUS</div><h1>${paid ? 'สั่งซื้อสำเร็จ' : 'รับคำสั่งซื้อแล้ว'}</h1><p class="intro">บันทึกเลขคำสั่งซื้อนี้ไว้สำหรับติดตามผล</p>${demo}<div class="order-id"><span>${esc(order.id)}</span><button type="button" class="button button-link" id="copy-id">คัดลอก</button></div><div class="status-line"><strong>สถานะ</strong><span class="status-badge ${paid ? 'status-paid' : 'status-pending'}">${paid ? 'PAID' : 'PENDING'}</span></div><div class="order-detail"><span class="muted">หนังสือ</span><span>${esc(order.title)}</span><span class="muted">ยอดรวมจำลอง</span><span>${money(order.price)}</span><span class="muted">อีเมล</span><span>${esc(order.email)}</span></div>${paid ? `<div class="delivery-box"><strong>การส่งมอบ</strong><p>${esc(deliveryText || 'รอผลการส่งอีเมล')}</p>${order.downloadUrl ? `<p><a href="${esc(order.downloadUrl)}" target="_blank" rel="noopener">เปิดลิงก์ดาวน์โหลด (ใช้ได้ 24 ชั่วโมง)</a></p>` : ''}</div>` : `<p class="muted">กดปุ่มด้านล่างเพื่อจำลองการชำระเงิน ระบบจะเปลี่ยนสถานะเป็น PAID</p><button class="button button-gold" id="pay-button">จำลองชำระเงินสำเร็จ</button>`}<div id="live-message" aria-live="polite"></div></div></div>`, 'track');
  document.querySelector('#copy-id').addEventListener('click', async () => { try { await navigator.clipboard.writeText(order.id); document.querySelector('#copy-id').textContent = 'คัดลอกแล้ว'; } catch {} });
  document.querySelector('#pay-button')?.addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังอัปเดต…';
    try { const data = await api('pay', { id: order.id, email: customerEmail }); currentOrder = data.order; orderPage(order.id); }
    catch (error) { document.querySelector('#live-message').innerHTML = message(error.message); button.disabled = false; button.textContent = 'จำลองชำระเงินสำเร็จ'; }
  });
}

function track(prefill = '') {
  setView(`<div class="narrow"><a class="back-link" href="#home">← กลับไปร้านหนังสือ</a><div class="panel track-panel"><div class="eyebrow">FIND YOUR ORDER</div><h1>ติดตามคำสั่งซื้อ</h1><p class="intro">กรอกเลขคำสั่งซื้อและอีเมลเดียวกับตอนสั่งซื้อ เพื่อดูสถานะ</p>${demo}<form id="track-form"><label for="order-id">เลขคำสั่งซื้อ</label><input id="order-id" name="id" required maxlength="27" value="${esc(prefill)}" placeholder="EB-..."><label for="track-email">อีเมล</label><input id="track-email" name="email" type="email" autocomplete="email" required placeholder="name@example.com"><div id="live-message" aria-live="polite"></div><button class="button" type="submit">ดูสถานะคำสั่งซื้อ</button></form></div></div>`, 'track');
  document.querySelector('#track-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
    try { const data = await api('order', { id: form.elements.namedItem('id').value.trim().toUpperCase(), email: form.elements.namedItem('email').value }); currentOrder = data.order; customerEmail = data.order.email; location.hash = `#order/${data.order.id}`; orderPage(data.order.id); }
    catch (error) { document.querySelector('#live-message').innerHTML = message(error.message); button.disabled = false; }
  });
}

function notFound() { setView(`<div class="narrow"><div class="panel track-panel"><h1>ไม่พบหน้านี้</h1><a class="button" href="#home">กลับไปร้านหนังสือ</a></div></div>`); }
function route() { const [section, id] = location.hash.slice(1).split('/'); if (!section || section === 'home') home(); else if (section === 'book') detail(id); else if (section === 'checkout') checkout(id); else if (section === 'order') orderPage(id); else if (section === 'track') track(); else notFound(); }

try { const data = await api('books'); books = data.books; window.addEventListener('hashchange', route); route(); }
catch (error) { app.innerHTML = `<div class="narrow"><div class="panel track-panel">${message(error.message)}</div></div>`; }
