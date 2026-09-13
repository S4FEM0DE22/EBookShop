const app = document.querySelector('#app');
const navLinks = [...document.querySelectorAll('[data-nav]')];
const cartCount = document.querySelector('#cart-count');
let books = [];
let currentOrder = null;
let customerEmail = '';
let carouselIndex = 1;
let cart = readSession('safe-cart', []);
let selected = new Set(cart);
let receipts = readSession('safe-orders', []);
let profileData = readSession('safe-profile', { name: '', email: '' });

function readSession(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeSession(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} }
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = amount => new Intl.NumberFormat('th-TH').format(amount) + ' บาท';
const book = id => books.find(item => item.id === id);
const cover = item => `<img class="book-cover" src="${esc(item.cover)}" alt="ปกหนังสือ ${esc(item.title)}" loading="lazy">`;
const notice = (text, kind = 'error') => `<div class="notice notice-${kind}" role="alert">${esc(text)}</div>`;
const demo = '<div class="demo-note"><strong>DEMO ONLY</strong><span>การชำระเงินเป็นเพียงการจำลอง ไม่มีการรับเงินจริง ไม่มีการเก็บข้อมูลบัตรหรือ OTP</span></div>';

async function api(path, payload) {
  const response = await fetch(`/api/${path}`, { method: payload ? 'POST' : 'GET', headers: payload ? { 'Content-Type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'ระบบขัดข้อง');
  return data;
}
function refreshCartCount() { cartCount.textContent = cart.length; cartCount.hidden = cart.length === 0; }
function setView(html, active = '') {
  app.innerHTML = html;
  navLinks.forEach(link => { const on = link.dataset.nav === active; link.classList.toggle('active', on); if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  refreshCartCount();
  window.scrollTo(0, 0);
}
function saveCart() { writeSession('safe-cart', cart); refreshCartCount(); }
function addToCart(id) { if (!cart.includes(id)) cart.push(id); selected.add(id); saveCart(); location.hash = '#cart'; cartPage(); }
function orderTabs(active) { return `<div class="order-tabs" role="navigation" aria-label="ส่วนคำสั่งซื้อ"><a class="${active === 'cart' ? 'active' : ''}" href="#cart">ตะกร้าสินค้า</a><a class="${active === 'track' ? 'active' : ''}" href="#track">ติดตามคำสั่งซื้อ</a><a class="${active === 'history' ? 'active' : ''}" href="#history">ประวัติการสั่งซื้อ</a></div>`; }
function pageHead(title, subtitle = '') { return `<div class="page-heading"><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`; }
function productCard(item) { return `<article class="product-card"><a class="product-cover" href="#book/${esc(item.id)}">${cover(item)}</a><div class="product-copy"><h3>${esc(item.title)}</h3><p class="product-subtitle">${esc(item.subtitle)}</p><p class="product-description">${esc(item.description)}</p><div class="product-bottom"><strong>${money(item.price)}</strong><div><a class="text-link" href="#book/${esc(item.id)}">รายละเอียด</a><button class="pill-button dark" type="button" data-add="${esc(item.id)}">เพิ่มลงตะกร้า</button></div></div></div></article>`; }

function home() {
  const item = books[carouselIndex] || books[0];
  const left = books[(carouselIndex + books.length - 1) % books.length];
  const right = books[(carouselIndex + 1) % books.length];
  setView(`${pageHead('หนังสือแนะนำ', 'เลือกเรื่องที่ใช่ แล้วเริ่มอ่านในแบบของคุณ')}
    <section class="showcase" aria-label="หนังสือแนะนำ">
      <button class="showcase-arrow" type="button" id="slide-prev" aria-label="หนังสือก่อนหน้า">‹</button>
      <div class="showcase-side" aria-hidden="true">${cover(left)}</div>
      <a class="showcase-feature" href="#book/${esc(item.id)}">${cover(item)}<span>${esc(item.title)}</span></a>
      <div class="showcase-side" aria-hidden="true">${cover(right)}</div>
      <button class="showcase-arrow" type="button" id="slide-next" aria-label="หนังสือถัดไป">›</button>
    </section><div class="showcase-actions"><span>${carouselIndex + 1} / ${books.length}</span><a class="pill-button light" href="#catalog">ดูหนังสือทั้งหมด →</a></div>`, 'home');
  document.querySelector('#slide-prev').addEventListener('click', () => { carouselIndex = (carouselIndex + books.length - 1) % books.length; home(); });
  document.querySelector('#slide-next').addEventListener('click', () => { carouselIndex = (carouselIndex + 1) % books.length; home(); });
}

function catalog() {
  setView(`<section class="catalog-hero"><div class="kicker">E-BOOK</div><h1>หนังสืออิเล็กทรอนิกส์<br><span>อ่านเรื่องใหม่เริ่มได้ที่นี่</span></h1><p>เลือกเอกสาร PDF ที่สนใจ แล้วลองสั่งซื้อผ่านระบบได้ทันที</p></section><div class="section-title"><h2>หนังสือทั้งหมด</h2><span>${books.length} เล่ม · เอกสาร PDF</span></div><div class="product-grid">${books.map(productCard).join('')}</div>`, 'catalog');
}

function detail(id) {
  const item = book(id); if (!item) return notFound();
  setView(`<a class="back-link" href="#catalog">← กลับไปหน้าสินค้า</a>${pageHead('รายละเอียดหนังสือ')}
    <section class="white-panel detail-panel"><div class="detail-cover">${cover(item)}</div><div class="detail-copy"><div class="kicker">E-BOOK / PDF</div><h2>${esc(item.title)}</h2><p class="detail-subtitle">${esc(item.subtitle)}</p><p>${esc(item.description)}</p><div class="detail-meta"><span>ผู้จัดทำ <strong>${esc(item.author)}</strong></span><span>รูปแบบ <strong>PDF</strong></span></div><strong class="detail-price">${money(item.price)}</strong><div class="detail-actions"><button class="pill-button dark" type="button" data-add="${esc(item.id)}">เพิ่มลงตะกร้า</button><a class="pill-button outline" href="#checkout/${esc(item.id)}">สั่งซื้อเล่มนี้</a></div></div></section>`, 'catalog');
}

function cartPage() {
  const items = cart.map(book).filter(Boolean);
  const selectedItems = items.filter(item => selected.has(item.id));
  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);
  setView(`${orderTabs('cart')}<section class="white-panel cart-panel"><h1>รายการในตะกร้า</h1>${items.length ? `<div class="cart-list">${items.map(item => `<div class="cart-row"><input type="checkbox" class="cart-check" aria-label="เลือก ${esc(item.title)}" data-select="${esc(item.id)}" ${selected.has(item.id) ? 'checked' : ''}><div class="cart-cover">${cover(item)}</div><div class="cart-copy"><h2>${esc(item.title)}</h2><p>${esc(item.subtitle)}</p><p>${esc(item.description)}</p><strong>${money(item.price)}</strong></div><button type="button" class="remove-button" aria-label="นำ ${esc(item.title)} ออกจากตะกร้า" data-remove="${esc(item.id)}">×</button></div>`).join('')}</div><div class="cart-total"><span>ราคารวม <strong>${money(total)}</strong></span><a class="pill-button dark ${selectedItems.length ? '' : 'disabled'}" href="${selectedItems.length ? '#checkout' : '#cart'}" ${selectedItems.length ? '' : 'aria-disabled="true"'}>ชำระเงินจำลอง →</a></div>` : `<div class="empty-state"><p>ตะกร้ายังว่างอยู่</p><a class="pill-button dark" href="#catalog">เลือกหนังสือ</a></div>`}</section>`, 'orders');
  document.querySelectorAll('[data-select]').forEach(input => input.addEventListener('change', event => { const id = event.currentTarget.dataset.select; if (event.currentTarget.checked) selected.add(id); else selected.delete(id); cartPage(); }));
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => { const id = event.currentTarget.dataset.remove; cart = cart.filter(item => item !== id); selected.delete(id); saveCart(); cartPage(); }));
}

function checkout(singleId = '') {
  const ids = singleId ? [singleId] : cart.filter(id => selected.has(id));
  const items = ids.map(book).filter(Boolean);
  if (!items.length) return cartPage();
  const total = items.reduce((sum, item) => sum + item.price, 0);
  setView(`<a class="back-link" href="${singleId ? `#book/${esc(singleId)}` : '#cart'}">← กลับไปตรวจรายการ</a>${pageHead('การชำระสินค้า')}
    <section class="white-panel checkout-panel"><div class="checkout-title"><div><div class="kicker">CHECKOUT / DEMO</div><h2>ยืนยันคำสั่งซื้อ</h2></div><span class="status-pill pending">ยังไม่ชำระ</span></div>${demo}
    <div class="checkout-columns"><div><h3>รายการสินค้า</h3>${items.map(item => `<div class="checkout-item"><div class="checkout-cover">${cover(item)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)}</p><b>${money(item.price)}</b></div></div>`).join('')}<div class="checkout-total"><span>ยอดรวมจำลอง</span><strong>${money(total)}</strong></div></div>
    <div><h3>ข้อมูลสำหรับรับหนังสือ</h3><form id="checkout-form"><label for="buyer-name">ชื่อผู้สั่งซื้อ</label><input id="buyer-name" name="name" minlength="2" maxlength="80" autocomplete="name" required value="${esc(profileData.name)}" placeholder="ชื่อของคุณ"><label for="buyer-email">อีเมล</label><input id="buyer-email" name="email" type="email" maxlength="254" autocomplete="email" required value="${esc(profileData.email)}" placeholder="name@example.com"><p class="field-note">ใช้รับลิงก์ดาวน์โหลดและติดตามคำสั่งซื้อ</p><div id="live-message" aria-live="polite"></div><button class="pill-button dark wide" type="submit">สร้างคำสั่งซื้อ PENDING</button></form></div></div></section>`, 'orders');
  document.querySelector('#checkout-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true;
    document.querySelector('#live-message').innerHTML = '';
    try {
      const { order } = await api('orders', { bookIds: ids, name: form.elements.namedItem('name').value, email: form.elements.namedItem('email').value });
      currentOrder = order; customerEmail = order.email;
      receipts = [{ id: order.id, email: order.email }, ...receipts.filter(item => item.id !== order.id)].slice(0, 20);
      writeSession('safe-orders', receipts);
      cart = cart.filter(id => !ids.includes(id)); ids.forEach(id => selected.delete(id)); saveCart();
      location.hash = `#order/${order.id}`; orderPage(order.id);
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function orderPage(id) {
  if (!currentOrder || currentOrder.id !== id) return track(id);
  const order = currentOrder;
  const paid = order.status === 'PAID';
  const items = order.items?.length ? order.items : [book(order.bookId)].filter(Boolean);
  const deliveryText = { SENT: 'ส่งอีเมลลิงก์ดาวน์โหลดแล้ว โปรดตรวจกล่องจดหมายและอีเมลขยะ', DEMO: 'โหมดทดสอบในเครื่อง: แสดงลิงก์ดาวน์โหลดแทนการส่งอีเมลจริง', FAILED: 'ส่งอีเมลไม่สำเร็จ ใช้ลิงก์ด้านล่างแทนได้', NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่าอีเมล ใช้ลิงก์ด้านล่างแทนได้' }[order.emailStatus];
  setView(`${orderTabs('track')}${pageHead(paid ? 'ชำระสินค้าเสร็จสิ้น' : 'รอชำระสินค้า')}
    <section class="white-panel status-panel"><div class="status-panel-head"><div><div class="kicker">ORDER STATUS</div><h2>คำสั่งซื้อ ${esc(order.id)}</h2></div><span class="status-pill ${paid ? 'paid' : 'pending'}">${paid ? 'PAID' : 'PENDING'}</span></div>${demo}<div class="status-id"><span>เลขคำสั่งซื้อ</span><strong>${esc(order.id)}</strong><button class="small-action" type="button" id="copy-id">คัดลอก</button></div><div class="status-items"><h3>รายละเอียดสินค้า</h3>${items.map(item => `<div class="status-item"><div class="status-cover">${cover(item)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)}</p><b>${money(item.price)}</b></div></div>`).join('')}</div><div class="status-facts"><div><span>ยอดรวมจำลอง</span><strong>${money(order.price)}</strong></div><div><span>อีเมลรับหนังสือ</span><strong>${esc(order.email)}</strong></div></div>${paid ? `<div class="delivery-panel"><h3>การส่งมอบ</h3><p>${esc(deliveryText || 'กำลังตรวจผลการส่งอีเมล')}</p>${items.map(item => order.downloadUrls?.[item.id] || (items.length === 1 ? order.downloadUrl : '') ? `<a href="${esc(order.downloadUrls?.[item.id] || order.downloadUrl)}" target="_blank" rel="noopener">ดาวน์โหลด ${esc(item.title)} ↗</a>` : '').join('')}<small>ลิงก์ใช้ได้ 24 ชั่วโมง ควรเปิดในเบราว์เซอร์หรือแอปอีเมล</small></div>` : `<div class="payment-demo"><div><h3>ชำระเงินจำลอง</h3><p>กดปุ่มเพื่อเปลี่ยนสถานะเป็น PAID และทดสอบการส่งมอบหนังสือ</p></div><button class="pill-button dark" type="button" id="pay-button">จำลองชำระเงินสำเร็จ</button></div>`}<div id="live-message" aria-live="polite"></div></section>`, 'orders');
  document.querySelector('#copy-id').addEventListener('click', async () => { try { await navigator.clipboard.writeText(order.id); document.querySelector('#copy-id').textContent = 'คัดลอกแล้ว'; } catch {} });
  document.querySelector('#pay-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังอัปเดต…'; try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'จำลองชำระเงินสำเร็จ'; } });
}

function track(prefill = '') {
  setView(`${orderTabs('track')}<section class="white-panel track-panel"><div class="kicker">FIND YOUR ORDER</div><h1>ติดตามคำสั่งซื้อ</h1><p>กรอกเลขคำสั่งซื้อและอีเมลเดียวกับที่ใช้สั่งซื้อ</p>${demo}<form id="track-form"><label for="track-id">เลขคำสั่งซื้อ</label><input id="track-id" name="id" required maxlength="27" value="${esc(prefill)}" placeholder="EB-..."><label for="track-email">อีเมล</label><input id="track-email" name="email" type="email" required placeholder="name@example.com"><div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">ดูสถานะคำสั่งซื้อ</button></form></section>`, 'orders');
  document.querySelector('#track-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; try { const data = await api('order', { id: form.elements.namedItem('id').value.trim().toUpperCase(), email: form.elements.namedItem('email').value }); currentOrder = data.order; customerEmail = data.order.email; location.hash = `#order/${data.order.id}`; orderPage(data.order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; } });
}

async function history() {
  setView(`${orderTabs('history')}<section class="white-panel history-panel"><h1>ประวัติการสั่งซื้อในอุปกรณ์นี้</h1><p class="field-note">แสดงเฉพาะคำสั่งซื้อที่สร้างในเซสชันนี้ หากต้องการดูรายการอื่น ใช้เลขคำสั่งซื้อและอีเมลในหน้าติดตาม</p><div id="history-list" class="history-list"><div class="loading">กำลังโหลดรายการ…</div></div></section>`, 'orders');
  const list = document.querySelector('#history-list');
  const result = await Promise.all(receipts.map(async receipt => { try { return (await api('order', receipt)).order; } catch { return null; } }));
  if (!list.isConnected) return;
  const orders = result.filter(Boolean);
  list.innerHTML = orders.length ? orders.map(order => `<article class="history-row"><div><strong>${esc(order.id)}</strong><p>${esc(order.items?.map(item => item.title).join(', ') || order.title)}</p></div><div><span class="status-pill ${order.status === 'PAID' ? 'paid' : 'pending'}">${esc(order.status)}</span><strong>${money(order.price)}</strong><button type="button" class="small-action" data-open-order="${esc(order.id)}">ดูรายละเอียด →</button></div></article>`).join('') : `<div class="empty-state"><p>ยังไม่มีประวัติในอุปกรณ์นี้</p><a class="pill-button dark" href="#catalog">เลือกหนังสือ</a></div>`;
  list.querySelectorAll('[data-open-order]').forEach(button => button.addEventListener('click', () => { currentOrder = orders.find(order => order.id === button.dataset.openOrder); customerEmail = currentOrder.email; location.hash = `#order/${currentOrder.id}`; orderPage(currentOrder.id); }));
}

function profile() {
  const parts = profileData.name.trim().split(/\s+/);
  setView(`<section class="profile-layout"><div class="white-panel profile-card"><div class="kicker">LOCAL PROFILE</div><h1>ข้อมูลสำหรับสั่งซื้อ</h1><p>บันทึกเฉพาะในเซสชันนี้เพื่อกรอก Checkout ให้เร็วขึ้น ไม่มีบัญชีหรือรหัสผ่าน</p><form id="profile-form"><div class="profile-fields"><div><label for="profile-first">ชื่อ</label><input id="profile-first" name="first" autocomplete="given-name" value="${esc(parts[0] || '')}" placeholder="ชื่อ"></div><div><label for="profile-last">นามสกุล</label><input id="profile-last" name="last" autocomplete="family-name" value="${esc(parts.slice(1).join(' '))}" placeholder="นามสกุล"></div></div><label for="profile-email">อีเมล</label><input id="profile-email" name="email" type="email" autocomplete="email" value="${esc(profileData.email)}" placeholder="name@example.com"><div id="live-message" aria-live="polite"></div><div class="profile-actions"><button class="pill-button dark" type="submit">บันทึกข้อมูล</button><a class="pill-button outline" href="#history">ประวัติการสั่งซื้อ</a></div></form></div><div class="profile-visual"><div class="avatar-graphic" aria-hidden="true"><span></span></div><p>SAFE MODE SHOP</p></div></section>`, 'profile');
  document.querySelector('#profile-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; const first = form.elements.namedItem('first').value.trim(); const last = form.elements.namedItem('last').value.trim(); const email = form.elements.namedItem('email').value.trim(); if (!first || (email && !form.elements.namedItem('email').validity.valid)) { document.querySelector('#live-message').innerHTML = notice('กรุณาตรวจชื่อและอีเมล'); return; } profileData = { name: [first, last].filter(Boolean).join(' '), email }; writeSession('safe-profile', profileData); document.querySelector('#live-message').innerHTML = notice('บันทึกข้อมูลในเซสชันนี้แล้ว', 'success'); });
}

function notFound() { setView(`<section class="white-panel empty-state"><h1>ไม่พบหน้านี้</h1><a class="pill-button dark" href="#home">กลับหน้าแรก</a></section>`); }
function route() { const [section, id] = location.hash.slice(1).split('/'); if (!section || section === 'home') home(); else if (section === 'catalog') catalog(); else if (section === 'book') detail(id); else if (section === 'cart') cartPage(); else if (section === 'checkout') checkout(id); else if (section === 'order') orderPage(id); else if (section === 'track') track(); else if (section === 'history') history(); else if (section === 'profile') profile(); else notFound(); }
app.addEventListener('click', event => { const add = event.target.closest('[data-add]'); if (add) addToCart(add.dataset.add); });
try { const data = await api('books'); books = data.books; cart = cart.filter(id => book(id)); selected = new Set(cart); refreshCartCount(); window.addEventListener('hashchange', route); route(); }
catch (error) { app.innerHTML = `<section class="white-panel empty-state">${notice(error.message)}</section>`; }
