const app = document.querySelector('#app');
const navLinks = [...document.querySelectorAll('[data-nav]')];
const cartCount = document.querySelector('#cart-count');
let books = [];
let currentOrder = null;
let customerEmail = '';
let customerUser = null;
let resetToken = '';
let authNext = '#catalog';
let carouselIndex = 1;
let cart = readSession('safe-cart', []);
let selected = new Set(cart);
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
  document.querySelector('[data-nav="profile"]').textContent = customerUser ? 'โปรไฟล์' : 'เข้าสู่ระบบ';
  navLinks.forEach(link => { const on = link.dataset.nav === active; link.classList.toggle('active', on); if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  refreshCartCount();
  window.scrollTo(0, 0);
}
function saveCart() { writeSession('safe-cart', cart); refreshCartCount(); }
function addToCart(id) { if (!cart.includes(id)) cart.push(id); selected.add(id); saveCart(); location.hash = '#cart'; cartPage(); }
function orderTabs(active) { return `<div class="order-tabs" role="navigation" aria-label="ส่วนคำสั่งซื้อ"><a class="${active === 'cart' ? 'active' : ''}" href="#cart">ตะกร้าสินค้า</a><a class="${active === 'track' ? 'active' : ''}" href="#track">ติดตามคำสั่งซื้อ</a><a class="${active === 'history' ? 'active' : ''}" href="#history">ประวัติการสั่งซื้อ</a></div>`; }
function statusInfo(order) {
  if (order.status === 'PAID') return { className: 'paid', label: 'หนังสือพร้อมโหลด', short: 'PAID' };
  if (order.status === 'CANCELLED') return { className: 'cancelled', label: 'ยกเลิกการสั่งซื้อ', short: 'CANCELLED' };
  return { className: 'pending', label: 'กำลังรอการชำระ...', short: 'PENDING' };
}
function orderRow(order, mode = 'track') {
  const items = order.items?.length ? order.items : [book(order.bookId)].filter(Boolean);
  const first = items[0];
  const status = statusInfo(order);
  const title = first ? `${first.title}${items.length > 1 ? ` และอีก ${items.length - 1} เล่ม` : ''}` : 'รายการหนังสือ';
  return `<article class="tracking-row">
    <div class="tracking-cover">${first ? cover(first) : ''}</div>
    <div class="tracking-copy"><h2>${esc(title)}</h2><p>${first ? esc(first.subtitle) : ''}</p><p class="tracking-description">${first ? esc(first.description) : ''}</p><strong>${money(order.price)}</strong><small>คำสั่งซื้อ ${esc(order.id)}</small></div>
    <div class="tracking-side"><div class="tracking-actions">${mode === 'track' && order.status === 'PENDING' ? `<button class="tracking-button pay" type="button" data-track-pay="${esc(order.id)}">ชำระเงิน</button><button class="tracking-button cancel" type="button" data-track-cancel="${esc(order.id)}">ยกเลิก</button>` : `<button class="tracking-button view" type="button" data-open-order="${esc(order.id)}">ดูรายละเอียด${order.status === 'PAID' ? ' / ดาวน์โหลด' : ''}</button>`}</div><span class="tracking-status ${status.className}">${status.label}</span></div>
  </article>`;
}
async function sessionOrders() {
  if (!customerUser) return [];
  return (await api('customer?view=orders')).orders;
}
function bindOpenOrders(container, orders) {
  container.querySelectorAll('[data-open-order]').forEach(button => button.addEventListener('click', () => {
    currentOrder = orders.find(order => order.id === button.dataset.openOrder);
    customerEmail = currentOrder.email;
    location.hash = `#order/${currentOrder.id}`;
    orderPage(currentOrder.id);
  }));
}
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

function authPage(mode = 'login', message = '') {
  if (customerUser) { location.hash = '#profile'; return profile(); }
  const register = mode === 'register';
  setView(`<section class="profile-layout auth-layout"><div class="white-panel profile-card auth-card"><div class="kicker">CUSTOMER ACCOUNT</div><h1>${register ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h1><p>เข้าสู่ระบบเพื่อสั่งซื้อ E-book และดูประวัติคำสั่งซื้อของคุณ</p><div class="auth-tabs"><a class="${register ? '' : 'active'}" href="#login">เข้าสู่ระบบ</a><a class="${register ? 'active' : ''}" href="#register">สมัครสมาชิก</a></div>${message ? notice(message, message.startsWith('ยืนยันอีเมลไม่สำเร็จ') ? 'error' : 'success') : ''}<form id="auth-form">${register ? '<label for="auth-username">Username</label><input id="auth-username" name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="เช่น safemode22"><p class="field-note">ใช้ตัวอักษรอังกฤษ ตัวเลข หรือ _ จำนวน 3–24 ตัว</p><label for="auth-email">อีเมล</label><input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="name@example.com">' : '<label for="auth-identifier">Username หรืออีเมล</label><input id="auth-identifier" name="identifier" autocomplete="username" required maxlength="254" placeholder="Username หรือ name@example.com">'}<label for="auth-password">รหัสผ่าน</label><input id="auth-password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="8" maxlength="128" placeholder="อย่างน้อย 8 ตัวอักษร"><div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">${register ? 'สร้างบัญชี' : 'เข้าสู่ระบบเพื่อซื้อ'}</button></form><p class="auth-note">${register ? 'อาจต้องยืนยันอีเมลก่อนเข้าสู่ระบบ ตามการตั้งค่า Supabase Auth' : 'ยังไม่มีบัญชี? <a href="#register">สมัครสมาชิก</a> · <a href="#forgot-password">ลืมรหัสผ่าน</a>'}</p></div><div class="profile-visual"><div class="avatar-graphic" aria-hidden="true"><span></span></div><p>SAFE MODE SHOP</p></div></section>`, 'profile');
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    document.querySelector('#live-message').innerHTML = '';
    try {
      const payload = { action: register ? 'register' : 'login', password: form.elements.namedItem('password').value };
      if (register) { payload.username = form.elements.namedItem('username').value; payload.email = form.elements.namedItem('email').value; }
      else payload.identifier = form.elements.namedItem('identifier').value;
      const result = await api('customer', payload);
      if (result.confirmationRequired) {
        location.hash = '#login';
        authPage('login', 'สมัครสมาชิกแล้ว กรุณายืนยันอีเมลจากจดหมายที่ได้รับก่อนเข้าสู่ระบบ');
        return;
      }
      customerUser = result.user;
      profileData = { name: profileData.email === customerUser.email ? profileData.name || customerUser.name : customerUser.name, email: customerUser.email };
      writeSession('safe-profile', profileData);
      const next = authNext;
      authNext = '#catalog';
      location.hash = next;
      route();
    } catch (error) {
      document.querySelector('#live-message').innerHTML = notice(error.message);
      button.disabled = false;
    }
  });
}

function forgotPage() {
  setView(`<section class="profile-layout auth-layout"><div class="white-panel profile-card auth-card"><div class="kicker">ACCOUNT RECOVERY</div><h1>ลืมรหัสผ่าน</h1><p>กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์เปลี่ยนรหัสผ่านให้</p><form id="forgot-form"><label for="forgot-email">อีเมลบัญชี</label><input id="forgot-email" name="email" type="email" autocomplete="email" required placeholder="name@example.com"><div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">ส่งลิงก์ทางอีเมล</button></form><p class="auth-note"><a href="#login">← กลับไปเข้าสู่ระบบ</a></p></div><div class="profile-visual"><div class="avatar-graphic" aria-hidden="true"></div></div></section>`, 'profile');
  document.querySelector('#forgot-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      const result = await api('customer', { action: 'forgot-password', email: event.currentTarget.elements.namedItem('email').value });
      document.querySelector('#live-message').innerHTML = notice('หากอีเมลนี้มีบัญชีอยู่ กรุณาตรวจกล่องจดหมายและอีเมลขยะ', 'success') + (result.demoResetUrl ? `<p class="auth-note">โหมดทดสอบในเครื่อง: <a href="${esc(result.demoResetUrl)}">เปิดลิงก์เปลี่ยนรหัสผ่าน</a></p>` : '');
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function resetPage() {
  if (!resetToken) return forgotPage();
  setView(`<section class="profile-layout auth-layout"><div class="white-panel profile-card auth-card"><div class="kicker">ACCOUNT RECOVERY</div><h1>ตั้งรหัสผ่านใหม่</h1><p>รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร</p><form id="reset-form"><label for="reset-password">รหัสผ่านใหม่</label><input id="reset-password" name="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128"><label for="reset-confirm">ยืนยันรหัสผ่านใหม่</label><input id="reset-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="8" maxlength="128"><div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">เปลี่ยนรหัสผ่าน</button></form></div><div class="profile-visual"><div class="avatar-graphic" aria-hidden="true"></div></div></section>`, 'profile');
  document.querySelector('#reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.namedItem('password').value;
    if (password !== form.elements.namedItem('confirm').value) { document.querySelector('#live-message').innerHTML = notice('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api('customer', { action: 'reset-password', token: resetToken, password });
      resetToken = '';
      customerUser = null;
      currentOrder = null;
      location.hash = '#login';
      authPage('login', 'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function requireLogin(next) {
  if (customerUser) return true;
  authNext = next;
  location.hash = '#login';
  authPage();
  return false;
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
  if (!requireLogin(singleId ? `#checkout/${singleId}` : '#checkout')) return;
  const ids = singleId ? [singleId] : cart.filter(id => selected.has(id));
  const items = ids.map(book).filter(Boolean);
  if (!items.length) return cartPage();
  const total = items.reduce((sum, item) => sum + item.price, 0);
  setView(`<a class="back-link" href="${singleId ? `#book/${esc(singleId)}` : '#cart'}">← กลับไปตรวจรายการ</a>${pageHead('การชำระสินค้า')}
    <section class="white-panel checkout-panel"><div class="checkout-title"><div><div class="kicker">CHECKOUT / DEMO</div><h2>ยืนยันคำสั่งซื้อ</h2></div><span class="status-pill pending">ยังไม่ชำระ</span></div>${demo}
    <div class="checkout-columns"><div><h3>รายการสินค้า</h3>${items.map(item => `<div class="checkout-item"><div class="checkout-cover">${cover(item)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)}</p><b>${money(item.price)}</b></div></div>`).join('')}<div class="checkout-total"><span>ยอดรวมจำลอง</span><strong>${money(total)}</strong></div></div>
    <div><h3>ข้อมูลสำหรับรับหนังสือ</h3><form id="checkout-form"><label for="buyer-name">ชื่อผู้สั่งซื้อ</label><input id="buyer-name" name="name" minlength="2" maxlength="80" autocomplete="name" required value="${esc(profileData.name || customerUser.name)}" placeholder="ชื่อของคุณ"><label for="buyer-email">อีเมลบัญชี</label><input id="buyer-email" name="email" type="email" value="${esc(customerUser.email)}" readonly><p class="field-note">หนังสือและคำสั่งซื้อจะผูกกับอีเมลบัญชีนี้</p><div id="live-message" aria-live="polite"></div><button class="pill-button dark wide" type="submit">สร้างคำสั่งซื้อ PENDING</button></form></div></div></section>`, 'orders');
  document.querySelector('#checkout-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true;
    document.querySelector('#live-message').innerHTML = '';
    try {
      const { order } = await api('orders', { bookIds: ids, name: form.elements.namedItem('name').value });
      currentOrder = order; customerEmail = order.email;
      cart = cart.filter(id => !ids.includes(id)); ids.forEach(id => selected.delete(id)); saveCart();
      location.hash = `#order/${order.id}`; orderPage(order.id);
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function pendingPayment(order, items) {
  setView(`${pageHead('การชำระสินค้า')}<section class="white-panel mock-payment-panel"><div class="kicker">PAYMENT / DEMO</div><h2>เลือกการชำระสินค้า</h2><div class="mock-methods" role="group" aria-label="ตัวเลือกการชำระเงินจำลอง"><button type="button" data-mock-method="card" aria-pressed="false">บัตรเครดิต</button><button type="button" data-mock-method="qr" class="active" aria-pressed="true">QR PromptPay</button></div><div class="mock-payment-grid"><div><h3>อีเมลสำหรับจัดส่งสินค้า</h3><div class="mock-readonly">${esc(order.email)}</div><h3>เลขคำสั่งซื้อ</h3><div class="mock-readonly order-number">${esc(order.id)}</div><p class="mock-payment-summary">${items.map(item => esc(item.title)).join(' · ')}<br><strong>ยอดรวมจำลอง ${money(order.price)}</strong></p></div><div class="mock-payment-explain"><span class="mock-symbol" aria-hidden="true">◎</span><h3>QR PromptPay (ตัวอย่าง)</h3><p id="mock-method-note">ไม่มี QR สำหรับรับเงินจริง กด “ยืนยันการชำระจำลอง” เพื่อทดสอบขั้นตอนถัดไป</p></div></div></section><div class="mock-payment-actions"><a class="pill-button light" href="#track">ชำระสินค้าในภายหลัง</a><button class="pill-button light" id="pay-button" type="button">ยืนยันการชำระจำลอง</button><button class="pill-button mock-cancel" id="cancel-button" type="button">ยกเลิกการชำระ</button></div><div id="live-message" class="mock-payment-message" aria-live="polite"></div>`, 'orders');
  document.querySelectorAll('[data-mock-method]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-mock-method]').forEach(option => { const active = option === button; option.classList.toggle('active', active); option.setAttribute('aria-pressed', String(active)); });
    const isCard = button.dataset.mockMethod === 'card';
    document.querySelector('.mock-payment-explain h3').textContent = isCard ? 'บัตรเครดิต (ตัวอย่าง)' : 'QR PromptPay (ตัวอย่าง)';
    document.querySelector('#mock-method-note').textContent = isCard ? 'ระบบนี้ไม่รับข้อมูลบัตรจริง กด “ยืนยันการชำระจำลอง” เพื่อทดสอบขั้นตอนถัดไป' : 'ไม่มี QR สำหรับรับเงินจริง กด “ยืนยันการชำระจำลอง” เพื่อทดสอบขั้นตอนถัดไป';
  }));
  document.querySelector('#pay-button').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังอัปเดต…';
    try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); }
    catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'ยืนยันการชำระจำลอง'; }
  });
  document.querySelector('#cancel-button').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { const data = await api('cancel', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); }
    catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function orderPage(id) {
  if (!requireLogin(`#order/${id}`)) return;
  if (!currentOrder || currentOrder.id !== id) return track(id);
  const order = currentOrder;
  const paid = order.status === 'PAID';
  const cancelled = order.status === 'CANCELLED';
  const status = statusInfo(order);
  const items = order.items?.length ? order.items : [book(order.bookId)].filter(Boolean);
  if (!paid && !cancelled) return pendingPayment(order, items);
  const deliveryText = { SENT: 'ส่งอีเมลลิงก์ดาวน์โหลดแล้ว โปรดตรวจกล่องจดหมายและอีเมลขยะ', DEMO: 'โหมดทดสอบในเครื่อง: แสดงลิงก์ดาวน์โหลดแทนการส่งอีเมลจริง', FAILED: 'ส่งอีเมลไม่สำเร็จ ใช้ลิงก์ด้านล่างแทนได้', NOT_CONFIGURED: 'ยังไม่ได้ตั้งค่าอีเมล ใช้ลิงก์ด้านล่างแทนได้', NOT_SENT: 'ยังไม่ได้ส่งอีเมล ใช้ลิงก์ด้านล่างแทนได้' }[order.emailStatus];
  setView(`${orderTabs('track')}${pageHead(paid ? 'ชำระสินค้าเสร็จสิ้น' : cancelled ? 'ยกเลิกคำสั่งซื้อแล้ว' : 'รอชำระสินค้า')}
    <section class="white-panel status-panel"><div class="status-panel-head"><div><div class="kicker">ORDER STATUS</div><h2>คำสั่งซื้อ ${esc(order.id)}</h2></div><span class="status-pill ${status.className}">${status.short}</span></div>${demo}<div class="status-id"><span>เลขคำสั่งซื้อ</span><strong>${esc(order.id)}</strong><button class="small-action" type="button" id="copy-id">คัดลอก</button></div><div class="status-items"><h3>รายละเอียดสินค้า</h3>${items.map(item => `<div class="status-item"><div class="status-cover">${cover(item)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)}</p><b>${money(item.price)}</b></div></div>`).join('')}</div><div class="status-facts"><div><span>ยอดรวมจำลอง</span><strong>${money(order.price)}</strong></div><div><span>อีเมลรับหนังสือ</span><strong>${esc(order.email)}</strong></div></div>${paid ? `<div class="delivery-panel"><h3>การส่งมอบ</h3><p>${esc(deliveryText || 'กำลังตรวจผลการส่งอีเมล')}</p>${items.map(item => order.downloadUrls?.[item.id] || (items.length === 1 ? order.downloadUrl : '') ? `<a href="${esc(order.downloadUrls?.[item.id] || order.downloadUrl)}" target="_blank" rel="noopener">ดาวน์โหลด ${esc(item.title)} ↗</a>` : '').join('')}${['FAILED', 'NOT_CONFIGURED', 'NOT_SENT'].includes(order.emailStatus) ? '<button class="pill-button outline" type="button" id="retry-email-button">ลองส่งอีเมลอีกครั้ง</button>' : ''}<small>ลิงก์ใช้ได้ 24 ชั่วโมง ควรเปิดในเบราว์เซอร์หรือแอปอีเมล</small></div>` : cancelled ? `<div class="cancelled-panel">คำสั่งซื้อนี้ถูกยกเลิกแล้ว ไม่มีการส่งลิงก์ดาวน์โหลด</div>` : `<div class="payment-demo"><div><h3>ชำระเงินจำลอง</h3><p>กดปุ่มเพื่อเปลี่ยนสถานะเป็น PAID และทดสอบการส่งมอบหนังสือ</p></div><div class="payment-actions"><button class="pill-button dark" type="button" id="pay-button">จำลองชำระเงินสำเร็จ</button><button class="pill-button danger-outline" type="button" id="cancel-button">ยกเลิกคำสั่งซื้อ</button></div></div>`}<div id="live-message" aria-live="polite"></div></section>`, 'orders');
  document.querySelector('#copy-id').addEventListener('click', async () => { try { await navigator.clipboard.writeText(order.id); document.querySelector('#copy-id').textContent = 'คัดลอกแล้ว'; } catch {} });
  document.querySelector('#pay-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังอัปเดต…'; try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { try { const latest = await api('order', { id: order.id, email: customerEmail || order.email }); if (latest.order.status !== order.status) { currentOrder = latest.order; orderPage(order.id); return; } } catch {} document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'จำลองชำระเงินสำเร็จ'; } });
  document.querySelector('#retry-email-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังส่ง…'; try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'ลองส่งอีเมลอีกครั้ง'; } });
  document.querySelector('#cancel-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; try { const data = await api('cancel', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; } });
}

async function track(prefill = '') {
  if (!requireLogin(prefill ? `#order/${prefill}` : '#track')) return;
  setView(`${orderTabs('track')}<section class="white-panel tracking-panel"><div class="tracking-heading"><h1>รายการการสั่งซื้อทั้งหมด</h1><button class="tracking-lookup-trigger" id="open-track-search" type="button" aria-label="ค้นหาคำสั่งซื้อด้วยเลขคำสั่งซื้อและอีเมล" aria-haspopup="dialog" aria-controls="track-search-dialog"><span class="tracking-search-label">ค้นหา<span class="tracking-search-extra">คำสั่งซื้อ</span></span><span class="tracking-search-icon" aria-hidden="true"></span></button></div><p class="tracking-note">คำสั่งซื้อของ ${esc(customerUser.email)} · การชำระเงินเป็นระบบจำลอง</p><div id="track-message" aria-live="polite"></div><div id="tracking-list" class="tracking-list"><div class="loading">กำลังโหลดรายการ…</div></div>
    <dialog class="track-dialog" id="track-search-dialog" aria-labelledby="track-dialog-title"><div class="track-dialog-head"><div><div class="kicker">FIND YOUR ORDER</div><h2 id="track-dialog-title">ค้นหาคำสั่งซื้อ</h2><p>กรอกเลขคำสั่งซื้อที่ผูกกับอีเมลบัญชีนี้</p></div><button class="track-dialog-close" id="close-track-search" type="button" aria-label="ปิดหน้าต่างค้นหา">×</button></div><form id="track-form"><label for="track-id">เลขคำสั่งซื้อ</label><input id="track-id" name="id" required maxlength="27" value="${esc(prefill)}" placeholder="EB-..." autofocus><label for="track-email">อีเมลบัญชี</label><input id="track-email" name="email" type="email" value="${esc(customerUser.email)}" readonly><div id="live-message" aria-live="polite"></div><div class="track-dialog-actions"><button class="pill-button outline" id="cancel-track-search" type="button">ปิด</button><button class="pill-button dark" type="submit">ดูสถานะคำสั่งซื้อ</button></div></form></dialog></section>`, 'orders');
  const dialog = document.querySelector('#track-search-dialog');
  document.querySelector('#open-track-search').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-track-search').addEventListener('click', () => dialog.close());
  document.querySelector('#cancel-track-search').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  if (prefill) dialog.showModal();
  document.querySelector('#track-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true; try { const data = await api('order', { id: form.elements.namedItem('id').value.trim().toUpperCase() }); currentOrder = data.order; customerEmail = data.order.email; dialog.close(); location.hash = `#order/${data.order.id}`; orderPage(data.order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; } });
  const list = document.querySelector('#tracking-list');
  let orders;
  try { orders = await sessionOrders(); }
  catch (error) { if (list.isConnected) list.innerHTML = notice(error.message); return; }
  if (!list.isConnected) return;
  list.innerHTML = orders.length ? orders.map(order => orderRow(order)).join('') : `<div class="empty-state"><p>บัญชีนี้ยังไม่มีคำสั่งซื้อ</p><a class="pill-button dark" href="#catalog">เลือกหนังสือ</a></div>`;
  bindOpenOrders(list, orders);
  for (const action of ['pay', 'cancel']) {
    list.querySelectorAll(`[data-track-${action}]`).forEach(button => button.addEventListener('click', async () => {
      const order = orders.find(item => item.id === button.dataset[`track${action[0].toUpperCase()}${action.slice(1)}`]);
      button.disabled = true;
      try {
        const data = await api(action, { id: order.id, email: order.email });
        currentOrder = data.order;
        customerEmail = order.email;
        await track();
      } catch (error) {
        document.querySelector('#track-message').innerHTML = notice(error.message);
        button.disabled = false;
      }
    }));
  }
}

async function history() {
  if (!requireLogin('#history')) return;
  setView(`${orderTabs('history')}<section class="white-panel tracking-panel history-panel"><h1>ประวัติการสั่งซื้อทั้งหมด</h1><p class="tracking-note">คำสั่งซื้อของ ${esc(customerUser.email)}</p><div id="history-list" class="tracking-list"><div class="loading">กำลังโหลดรายการ…</div></div></section>`, 'orders');
  const list = document.querySelector('#history-list');
  let orders;
  try { orders = await sessionOrders(); }
  catch (error) { if (list.isConnected) list.innerHTML = notice(error.message); return; }
  if (!list.isConnected) return;
  list.innerHTML = orders.length ? orders.map(order => orderRow(order, 'history')).join('') : `<div class="empty-state"><p>บัญชีนี้ยังไม่มีประวัติคำสั่งซื้อ</p><a class="pill-button dark" href="#catalog">เลือกหนังสือ</a></div>`;
  bindOpenOrders(list, orders);
}

function profile() {
  if (!customerUser) return authPage();
  const parts = (profileData.name || customerUser.name || '').trim().split(/\s+/);
  setView(`<section class="profile-layout"><div class="white-panel profile-card"><div class="kicker">CUSTOMER PROFILE</div><h1>โปรไฟล์ลูกค้า</h1><p>คำสั่งซื้อและหนังสือที่ได้รับผูกกับบัญชี ${esc(customerUser.email)}</p>${customerUser.username ? `<p class="profile-username">Username: <strong>${esc(customerUser.username)}</strong></p>` : `<form id="username-form"><label for="profile-username">ตั้ง Username</label><input id="profile-username" name="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="เช่น safemode22"><button class="pill-button outline" type="submit">บันทึก Username</button></form>`}<form id="profile-form"><div class="profile-fields"><div><label for="profile-first">ชื่อ</label><input id="profile-first" name="first" autocomplete="given-name" value="${esc(parts[0] || '')}" placeholder="ชื่อ"></div><div><label for="profile-last">นามสกุล</label><input id="profile-last" name="last" autocomplete="family-name" value="${esc(parts.slice(1).join(' '))}" placeholder="นามสกุล"></div></div><label for="profile-email">อีเมลบัญชี</label><input id="profile-email" name="email" type="email" value="${esc(customerUser.email)}" readonly><p class="field-note">ชื่อที่แก้ไขจะใช้กรอกคำสั่งซื้อครั้งถัดไปบนอุปกรณ์นี้</p><div id="live-message" aria-live="polite"></div><div class="profile-actions"><button class="pill-button dark" type="submit">บันทึกชื่อ</button><a class="pill-button outline" href="#history">ประวัติการสั่งซื้อ</a><a class="pill-button outline" href="#forgot-password">เปลี่ยนรหัสผ่าน</a><button class="pill-button danger-outline" id="customer-logout" type="button">ออกจากระบบ</button></div></form></div><div class="profile-visual"><div class="avatar-graphic" aria-hidden="true"><span></span></div><p>SAFE MODE SHOP</p></div></section>`, 'profile');
  document.querySelector('#username-form')?.addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true; try { const result = await api('customer', { action: 'claim-username', username: form.elements.namedItem('username').value }); customerUser = result.user; profile(); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; } });
  document.querySelector('#profile-form').addEventListener('submit', event => { event.preventDefault(); const form = event.currentTarget; const first = form.elements.namedItem('first').value.trim(); const last = form.elements.namedItem('last').value.trim(); if (!first) { document.querySelector('#live-message').innerHTML = notice('กรุณากรอกชื่อ'); return; } profileData = { name: [first, last].filter(Boolean).join(' '), email: customerUser.email }; writeSession('safe-profile', profileData); document.querySelector('#live-message').innerHTML = notice('บันทึกชื่อแล้ว', 'success'); });
  document.querySelector('#customer-logout').addEventListener('click', async event => { event.currentTarget.disabled = true; try { await api('customer', { action: 'logout' }); customerUser = null; currentOrder = null; customerEmail = ''; cart = []; selected.clear(); saveCart(); profileData = { name: '', email: '' }; writeSession('safe-profile', profileData); location.hash = '#login'; authPage(); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); event.currentTarget.disabled = false; } });
}

function notFound() { setView(`<section class="white-panel empty-state"><h1>ไม่พบหน้านี้</h1><a class="pill-button dark" href="#home">กลับหน้าแรก</a></section>`); }
function route() { const [section, id] = location.hash.slice(1).split('/'); if (!section || section === 'home') home(); else if (section === 'catalog') catalog(); else if (section === 'book') detail(id); else if (section === 'cart') cartPage(); else if (section === 'checkout') checkout(id); else if (section === 'order') orderPage(id); else if (section === 'track') track(); else if (section === 'history') history(); else if (section === 'profile') profile(); else if (section === 'login' || section === 'register') authPage(section); else if (section === 'forgot-password') forgotPage(); else if (section === 'reset-password') resetPage(); else notFound(); }
app.addEventListener('click', event => { const add = event.target.closest('[data-add]'); if (add) addToCart(add.dataset.add); });
try { const [catalog, session] = await Promise.all([api('books'), api('customer?view=session')]); books = catalog.books; customerUser = session.user; if (customerUser && profileData.email !== customerUser.email) profileData = { name: customerUser.name, email: customerUser.email }; cart = cart.filter(id => book(id)); selected = new Set(cart); refreshCartCount(); window.addEventListener('hashchange', route); if (/^#(access_token|error=|error_code=)/.test(location.hash)) { const params = new URLSearchParams(location.hash.slice(1)); const failed = params.has('error'); const recovery = params.get('type') === 'recovery' && params.has('access_token'); resetToken = recovery ? params.get('access_token') : ''; history.replaceState(null, '', recovery ? '#reset-password' : '#login'); if (recovery) resetPage(); else authPage('login', failed ? 'ลิงก์ยืนยันหมดอายุหรือไม่ถูกต้อง' : 'ยืนยันอีเมลแล้ว กรุณาเข้าสู่ระบบ'); } else if (location.hash.startsWith('#reset-password?token=')) { resetToken = new URLSearchParams(location.hash.split('?')[1]).get('token') || ''; history.replaceState(null, '', '#reset-password'); resetPage(); } else route(); }
catch (error) { app.innerHTML = `<section class="white-panel empty-state">${notice(error.message)}</section>`; }
