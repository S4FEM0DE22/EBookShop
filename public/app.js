const app = document.querySelector('#app');
const navLinks = [...document.querySelectorAll('[data-nav]')];
const cartCount = document.querySelector('#cart-count');
const navAuthAction = document.querySelector('#nav-auth-action');
let books = [];
let currentOrder = null;
let customerEmail = '';
let customerUser = null;
let resetToken = '';
let authNext = readSession('safe-auth-next', '#catalog');
let carouselIndex = 1;
let cart = readSession('safe-cart', []);
let selected = new Set(cart);
let profileData = readSession('safe-profile', { name: '', email: '' });

function readSession(key, fallback) {
  try { return JSON.parse(sessionStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeSession(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {} }
function safeDestination(value) {
  return typeof value === 'string' && /^#(?:home|catalog|book\/[a-z0-9-]+|cart|checkout(?:\/[a-z0-9-]+)?|order\/EB-[A-F0-9]{24}|track|history|profile)$/.test(value) ? value : '#catalog';
}
function rememberDestination(value) { authNext = safeDestination(value); writeSession('safe-auth-next', authNext); }
function clearActiveFocus() {
  if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
}
function finishAuth() {
  const next = safeDestination(authNext);
  rememberDestination('#catalog');
  window.history.replaceState(null, '', next);
  route(true);
}
function goBack(fallback = '#home') {
  clearActiveFocus();
  if (window.history.length > 1 && (!document.referrer || document.referrer.startsWith(location.origin))) window.history.back();
  else location.hash = fallback;
}
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = amount => new Intl.NumberFormat('th-TH').format(amount) + ' บาท';
const book = id => books.find(item => item.id === id);
const cover = (item, eager = false) => `<img class="book-cover" src="${esc(item.cover)}" alt="ปกหนังสือ ${esc(item.title)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
const notice = (text, kind = 'error') => `<div class="notice notice-${kind}" role="alert">${esc(text)}</div>`;
const demo = '<div class="demo-note"><strong>DEMO ONLY</strong><span>การชำระเงินเป็นเพียงการจำลอง ไม่มีการรับเงินจริง ไม่มีการเก็บข้อมูลบัตรหรือ OTP</span></div>';

function normalizeUserNames(source = {}) {
  const firstName = (typeof source.first_name === 'string' ? source.first_name : (typeof source.firstName === 'string' ? source.firstName : '')).trim();
  const lastName = (typeof source.last_name === 'string' ? source.last_name : (typeof source.lastName === 'string' ? source.lastName : '')).trim();
  let fullName = (typeof source.full_name === 'string' ? source.full_name : (typeof source.name === 'string' ? source.name : '')).trim();

  let resolvedFirst = firstName;
  let resolvedLast = lastName;

  if (!resolvedFirst && !resolvedLast && fullName && fullName !== source.username) {
    const parts = fullName.split(/\s+/);
    resolvedFirst = parts[0] || '';
    resolvedLast = parts.slice(1).join(' ') || '';
  }

  const combinedName = [resolvedFirst, resolvedLast].filter(Boolean).join(' ');
  const finalName = combinedName || fullName || source.username || '';

  return {
    firstName: resolvedFirst,
    lastName: resolvedLast,
    first_name: resolvedFirst,
    last_name: resolvedLast,
    fullName: finalName,
    name: finalName
  };
}

function getUserDisplayName(user, fallback = '') {
  if (!user) return fallback;
  const names = normalizeUserNames(user);
  return names.fullName || user.username || fallback;
}

async function api(path, payload) {
  const response = await fetch(`/api/${path}`, { method: payload ? 'POST' : 'GET', headers: payload ? { 'Content-Type': 'application/json' } : {}, body: payload ? JSON.stringify(payload) : undefined, cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && customerUser) {
      rememberDestination(location.hash || '#catalog');
      customerUser = null;
      currentOrder = null;
      customerEmail = '';
      window.history.replaceState(null, '', '#login');
      authPage('login', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    }
    throw new Error(data.error || 'ระบบขัดข้อง');
  }
  return data;
}
function refreshCartCount() { cartCount.textContent = cart.length; cartCount.hidden = cart.length === 0; }
function setView(html, active = '') {
  clearActiveFocus();
  clearInterval(carouselInterval);
  app.innerHTML = html;
  const isAuth = active === 'login' || active === 'register';
  document.body.classList.toggle('auth-active', isAuth);
  for (const link of navLinks) {
    link.hidden = isAuth && !link.classList.contains('nav-auth-action');
  }
  const displayName = getUserDisplayName(customerUser, profileData);
  navAuthAction.classList.toggle('signed-in', Boolean(customerUser));
  navAuthAction.setAttribute('aria-label', customerUser ? `บัญชีผู้ใช้: ${displayName || 'โปรไฟล์'}` : 'บัญชีผู้ใช้: เข้าสู่ระบบ');
  navLinks.forEach(link => { const on = link.dataset.nav === active; link.classList.toggle('active', on); if (on) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  refreshCartCount();
  window.scrollTo(0, 0);
}
function saveCart() { writeSession('safe-cart', cart); refreshCartCount(); }
function addToCart(id) { if (!cart.includes(id)) cart.push(id); selected.add(id); saveCart(); location.hash = '#cart'; cartPage(); }
function orderTabs(active) { return `<div class="order-tabs" role="navigation" aria-label="ส่วนคำสั่งซื้อ"><a class="${active === 'track' ? 'active' : ''}" href="#track">ติดตามคำสั่งซื้อ</a><a class="${active === 'history' ? 'active' : ''}" href="#history">ประวัติการสั่งซื้อ</a></div>`; }
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
    <div class="tracking-side"><div class="tracking-actions">${mode === 'guest' ? '<a class="tracking-button view" href="#login">เข้าสู่ระบบเพื่อดูรายละเอียด</a>' : mode === 'track' && order.status === 'PENDING' ? `<button class="tracking-button pay" type="button" data-track-pay="${esc(order.id)}">ชำระเงิน</button><button class="tracking-button cancel" type="button" data-track-cancel="${esc(order.id)}">ยกเลิก</button>` : `<button class="tracking-button view" type="button" data-open-order="${esc(order.id)}">ดูรายละเอียด${order.status === 'PAID' ? ' / ดาวน์โหลด' : ''}</button>`}</div><span class="badge ${status.className}">${status.label}</span></div>
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
function productCard(item) { return `<article class="product-card"><a class="product-cover" href="#book/${esc(item.id)}">${cover(item)}</a><div class="product-copy"><h3>${esc(item.title)}</h3><p class="product-description">${esc(item.description)}</p><div class="product-bottom"><strong>${money(item.price)}</strong><button class="pill-button dark" type="button" data-add="${esc(item.id)}">เพิ่มลงตะกร้า</button></div></div></article>`; }

function recommendedCard(item, index, total) {
  const isVisible = index === 0 || index === 1 || index === total - 1;
  let initClass = '';
  if (total > 0) {
    if (index === 0) initClass = ' center';
    else if (index === 1 || (total === 2 && index === 1)) initClass = ' next';
    else if (index === total - 1) initClass = ' prev';
    else if (index > total / 2) initClass = ' hidden-left';
    else initClass = ' hidden-right';
  }
  return `<a class="recommended-item${initClass}" data-index="${index}" href="#book/${esc(item.id)}" title="${esc(item.title)}"><div class="recommended-cover-wrap">${cover(item, isVisible)}</div><div class="recommended-title"><h3>${esc(item.title)}</h3></div></a>`;
}

function home() {
  let displayBooks = books.filter(b => b.is_featured);
  if (!displayBooks.length) displayBooks = books.slice(0, 8); // Fallback to first 8 books

  const trackItems = displayBooks.map((b, i) => recommendedCard(b, i, displayBooks.length)).join('');

  setView(`
    ${pageHead('หนังสือแนะนำ', 'เลือกเรื่องที่ใช่ แล้วเริ่มอ่านในแบบของคุณ')}
    <section class="recommended-section" aria-label="หนังสือแนะนำ">
      <button class="rec-arrow prev" aria-label="ก่อนหน้า" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="recommended-viewport">
        <div class="recommended-fade left"></div>
        <div class="recommended-track" id="rec-track">
          ${trackItems}
        </div>
        <div class="recommended-fade right"></div>
      </div>
      <button class="rec-arrow next" aria-label="ถัดไป" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    </section>
    <div class="home-actions"><a class="pill-button light" href="#catalog">ดูหนังสือทั้งหมด →</a></div>
  `, 'home');
  initCarousel(displayBooks.length);
}

let carouselInterval = null;
function initCarousel(total) {
  clearInterval(carouselInterval);
  const track = document.getElementById('rec-track');
  if (!track || total === 0) return;
  const prevBtn = document.querySelector('.rec-arrow.prev');
  const nextBtn = document.querySelector('.rec-arrow.next');
  let isPaused = false;
  let currentIndex = 0;
  const items = Array.from(track.children);
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderCarousel() {
    items.forEach((item, i) => {
      item.classList.remove('center', 'prev', 'next', 'hidden-left', 'hidden-right');
      const diff = (i - currentIndex + total) % total;

      if (diff === 0) {
        item.classList.add('center');
      } else if (diff === 1 || (diff === total - 1 && total === 2 && i > currentIndex)) {
        item.classList.add('next');
      } else if (diff === total - 1) {
        item.classList.add('prev');
      } else {
        // Decide whether to hide left or right to make rotation direction smooth
        if (diff > total / 2) {
          item.classList.add('hidden-left');
        } else {
          item.classList.add('hidden-right');
        }
      }
    });
  }

  function next() {
    currentIndex = (currentIndex + 1) % total;
    renderCarousel();
  }

  function prevSlide() {
    currentIndex = (currentIndex - 1 + total) % total;
    renderCarousel();
  }

  function resetTimer() {
    clearInterval(carouselInterval);
    if (!isReduced) {
      carouselInterval = setInterval(() => {
        if (!document.getElementById('rec-track')) { clearInterval(carouselInterval); return; }
        if (!isPaused && document.visibilityState === 'visible') {
          next();
        }
      }, 5000);
    }
  }

  renderCarousel();
  prevBtn.addEventListener('click', () => { prevSlide(); resetTimer(); });
  nextBtn.addEventListener('click', () => { next(); resetTimer(); });
  track.addEventListener('pointerenter', () => { isPaused = true; });
  track.addEventListener('pointerleave', () => { isPaused = false; });
  track.addEventListener('focusin', () => { isPaused = true; });
  track.addEventListener('focusout', () => { isPaused = false; });

  let touchStartX = 0;
  let touchStartY = 0;
  let isTouching = false;
  let swiped = false;

  track.addEventListener('touchstart', event => {
    if (event.touches.length === 1) {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      isTouching = true;
      swiped = false;
      isPaused = true;
    }
  }, { passive: true });

  track.addEventListener('touchend', event => {
    if (!isTouching || !event.changedTouches.length) {
      isPaused = false;
      resetTimer();
      return;
    }
    isTouching = false;
    isPaused = false;

    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;

    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY)) {
      swiped = true;
      if (deltaX < 0) {
        next();
      } else {
        prevSlide();
      }
    }
    resetTimer();
  }, { passive: true });

  track.addEventListener('touchcancel', () => {
    isTouching = false;
    isPaused = false;
    resetTimer();
  }, { passive: true });

  track.addEventListener('click', event => {
    if (swiped) {
      event.preventDefault();
      event.stopPropagation();
      swiped = false;
    }
  }, true);

  resetTimer();
}

function catalog() {
  setView(`<section class="catalog-hero"><div class="catalog-hero-content"><div class="kicker">E-BOOK</div><h1>หนังสืออิเล็กทรอนิกส์<span class="catalog-hero-sub">อ่านเรื่องใหม่ เริ่มได้ทันที</span></h1><p class="catalog-hero-desc">เลือก E-Book ที่เหมาะกับคุณ ทั้งหนังสือ คู่มือ และเนื้อหาสำหรับการเรียนรู้ สั่งซื้อได้ง่าย และเข้าถึงหนังสือของคุณได้สะดวกหลังคำสั่งซื้อสำเร็จ</p><div class="catalog-hero-features"><span class="hero-pill"><span class="hero-pill-dot" aria-hidden="true">•</span> เลือกหนังสือได้ง่าย</span><span class="hero-pill"><span class="hero-pill-dot" aria-hidden="true">•</span> สั่งซื้อสะดวก</span><span class="hero-pill"><span class="hero-pill-dot" aria-hidden="true">•</span> เข้าถึง E-Book ได้หลังคำสั่งซื้อสำเร็จ</span></div></div></section><div class="section-title"><h2>หนังสือทั้งหมด</h2><span>${books.length} เล่ม · หนังสืออิเล็กทรอนิกส์</span></div><div class="product-grid">${books.map(productCard).join('')}</div>`, 'catalog');
}

function detail(id) {
  const item = book(id); if (!item) return notFound();
  setView(`<button class="back-link" type="button" data-back-fallback="#catalog">← ย้อนกลับ</button>${pageHead('รายละเอียดหนังสือ')}
    <section class="white-panel detail-panel"><div class="detail-cover">${cover(item)}</div><div class="detail-copy"><div class="kicker">E-BOOK / PDF</div><h2>${esc(item.title)}</h2><p class="detail-subtitle">${esc(item.subtitle)}</p><p>${esc(item.description)}</p><div class="detail-meta"><span>ผู้จัดทำ <strong>${esc(item.author)}</strong></span><span>รูปแบบ <strong>PDF</strong></span></div><strong class="detail-price">${money(item.price)}</strong><div class="detail-actions"><button class="pill-button dark" type="button" data-add="${esc(item.id)}">เพิ่มลงตะกร้า</button><a class="pill-button outline" href="#checkout/${esc(item.id)}">สั่งซื้อเล่มนี้</a></div></div></section>`, 'catalog');
}

function authPage(mode = 'login', message = '') {
  if (customerUser) { window.history.replaceState(null, '', safeDestination(authNext) === '#catalog' ? '#profile' : safeDestination(authNext)); return route(); }
  const register = mode === 'register';
  const formFields = register
    ? `<label for="auth-username">Username</label><input id="auth-username" name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" placeholder="Username"><p class="field-note">ใช้ตัวอักษรอังกฤษ ตัวเลข หรือ _ จำนวน 3–24 ตัว</p><label for="auth-first">ชื่อ</label><input id="auth-first" name="first" autocomplete="given-name" maxlength="80" placeholder="ชื่อ"><label for="auth-last">นามสกุล</label><input id="auth-last" name="last" autocomplete="family-name" maxlength="80" placeholder="นามสกุล"><label for="auth-email">อีเมล</label><input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="อีเมล">`
    : `<label for="auth-identifier">Username หรืออีเมล</label><input id="auth-identifier" name="identifier" autocomplete="username" required maxlength="254" placeholder="Username หรืออีเมล">`;
  const passIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const passWrap = (id, name, auto, placeholder) => `<div class="password-wrap"><input id="${id}" name="${name}" type="password" autocomplete="${auto}" required minlength="8" maxlength="128" placeholder="${placeholder}"><button type="button" class="toggle-password" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${passIcon}</button></div>`;
  const form = `<form id="auth-form">${formFields}<label for="auth-password">รหัสผ่าน</label>${passWrap('auth-password', 'password', register ? 'new-password' : 'current-password', 'Password')}${register ? `<label for="auth-confirm">ยืนยันรหัสผ่าน</label>${passWrap('auth-confirm', 'confirmPassword', 'new-password', 'Confirm Password')}` : ''}<div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">${register ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}</button></form>`;
  const content = register
    ? `<h2 class="auth-title">สร้างบัญชี</h2><p class="auth-desc">กรอกข้อมูลด้านล่างเพื่อดำเนินการต่อ</p>${form}<div class="auth-bottom"><a class="auth-switch" href="#login">มีบัญชีอยู่แล้ว? เข้าสู่ระบบ</a></div>`
    : `<h2 class="auth-title">เข้าสู่ระบบ</h2><p class="auth-desc">เข้าสู่บัญชีของคุณเพื่อดำเนินการต่อ</p>${message ? notice(message, message.startsWith('ลิงก์ยืนยัน') ? 'error' : 'success') : ''}${form}<div class="auth-bottom"><a class="auth-link" href="#forgot-password">ลืมรหัสผ่าน?</a><a class="auth-switch" href="#register">ยังไม่มีบัญชี? สมัครสมาชิก</a></div>`;
  const brandArea = `<div class="auth-brand"><div class="kicker">E-BOOK STORE</div><h1>${register ? 'อ่านเรื่องใหม่<br>เริ่มได้ที่นี่' : 'ยินดีต้อนรับ<br>กลับมา'}</h1><p>${register ? 'สร้างบัญชีเพื่อบันทึกคำสั่งซื้อและเข้าถึง E-book ของคุณ' : 'เข้าสู่ระบบเพื่อดูคำสั่งซื้อและเข้าถึง E-book ของคุณ'}</p></div>`;
  setView(`<section class="auth-layout">${brandArea}<div class="white-panel auth-card">${content}</div></section>`, register ? 'register' : 'login');
  document.querySelectorAll('.toggle-password').forEach(btn => btn.addEventListener('click', e => {
    const input = e.currentTarget.previousElementSibling;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-pressed', String(isPass));
    e.currentTarget.innerHTML = isPass ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>' : passIcon;
  }));
  document.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = register ? 'กำลังสร้างบัญชี...' : 'กำลังเข้าสู่ระบบ...';
    document.querySelector('#live-message').innerHTML = '';
    try {
      const payload = { action: register ? 'register' : 'login', password: form.elements.namedItem('password').value };
      if (register) {
        payload.username = form.elements.namedItem('username').value.trim();
        payload.email = form.elements.namedItem('email').value.trim();
        payload.first = form.elements.namedItem('first')?.value.trim() || '';
        payload.last = form.elements.namedItem('last')?.value.trim() || '';
        payload.confirmPassword = form.elements.namedItem('confirmPassword').value;
        if (payload.password !== payload.confirmPassword) throw new Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      }
      else payload.identifier = form.elements.namedItem('identifier').value;
      const result = await api('customer', payload);
      if (result.confirmationRequired) { document.querySelector('#live-message').innerHTML = notice('สมัครสมาชิกแล้ว กรุณายืนยันอีเมลจากจดหมายก่อนเข้าสู่ระบบ', 'success'); button.textContent = originalText; return; }
      customerUser = result.user;
      profileData = { name: customerUser.name || '', firstName: customerUser.firstName || '', lastName: customerUser.lastName || '', email: customerUser.email };
      writeSession('safe-profile', profileData);
      finishAuth();
    } catch (error) {
      document.querySelector('#live-message').innerHTML = notice(error.message);
      button.disabled = false;
      button.textContent = originalText;
    }
  });
}

function forgotPage() {
  const brandArea = `<div class="auth-brand"><div class="kicker">E-BOOK STORE</div><h1>ยินดีต้อนรับ<br>กลับมา</h1><p>เข้าสู่ระบบเพื่อดูคำสั่งซื้อและเข้าถึง E-book ของคุณ</p></div>`;
  setView(`<section class="auth-layout">${brandArea}<div class="white-panel auth-card"><h2 class="auth-title">ลืมรหัสผ่าน</h2><p class="auth-desc">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์เปลี่ยนรหัสผ่านให้</p><form id="forgot-form"><label for="forgot-email">อีเมลบัญชี</label><input id="forgot-email" name="email" type="email" autocomplete="email" required placeholder="อีเมล"><div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">ส่งลิงก์ทางอีเมล</button></form><div class="auth-bottom"><a class="auth-switch" href="#login">← กลับไปเข้าสู่ระบบ</a></div></div></section>`, 'login');
  document.querySelector('#forgot-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'กำลังส่ง...';
    try {
      const result = await api('customer', { action: 'forgot-password', email: event.currentTarget.elements.namedItem('email').value });
      document.querySelector('#live-message').innerHTML = notice('หากอีเมลนี้มีบัญชีอยู่ กรุณาตรวจกล่องจดหมายและอีเมลขยะ', 'success') + (result.demoResetUrl ? `<p class="auth-note">โหมดทดสอบในเครื่อง: <a href="${esc(result.demoResetUrl)}">เปิดลิงก์เปลี่ยนรหัสผ่าน</a></p>` : '');
      button.textContent = originalText;
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = originalText; }
  });
}

function resetPage() {
  if (!resetToken) return forgotPage();
  const brandArea = `<div class="auth-brand"><div class="kicker">E-BOOK STORE</div><h1>ยินดีต้อนรับ<br>กลับมา</h1><p>เข้าสู่ระบบเพื่อดูคำสั่งซื้อและเข้าถึง E-book ของคุณ</p></div>`;
  const passIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
  const passWrap = (id, name, auto, placeholder) => `<div class="password-wrap"><input id="${id}" name="${name}" type="password" autocomplete="${auto}" required minlength="8" maxlength="128" placeholder="${placeholder}"><button type="button" class="toggle-password" aria-label="แสดงรหัสผ่าน" aria-pressed="false">${passIcon}</button></div>`;
  setView(`<section class="auth-layout">${brandArea}<div class="white-panel auth-card"><h2 class="auth-title">ตั้งรหัสผ่านใหม่</h2><p class="auth-desc">รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร</p><form id="reset-form"><label for="reset-password">รหัสผ่านใหม่</label>${passWrap('reset-password', 'password', 'new-password', 'Password')}<label for="reset-confirm">ยืนยันรหัสผ่านใหม่</label>${passWrap('reset-confirm', 'confirm', 'new-password', 'Confirm Password')}<div id="live-message" aria-live="polite"></div><button class="pill-button dark" type="submit">เปลี่ยนรหัสผ่าน</button></form></div></section>`, 'login');
  document.querySelectorAll('.toggle-password').forEach(btn => btn.addEventListener('click', e => {
    const input = e.currentTarget.previousElementSibling;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-pressed', String(isPass));
    e.currentTarget.innerHTML = isPass ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>' : passIcon;
  }));
  document.querySelector('#reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.namedItem('password').value;
    if (password !== form.elements.namedItem('confirm').value) { document.querySelector('#live-message').innerHTML = notice('รหัสผ่านสองช่องไม่ตรงกัน'); return; }
    const button = form.querySelector('button');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'กำลังเปลี่ยนรหัสผ่าน...';
    try {
      await api('customer', { action: 'reset-password', token: resetToken, password });
      resetToken = '';
      customerUser = null;
      currentOrder = null;
      location.hash = '#login';
      authPage('login', 'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = originalText; }
  });
}

function requireLogin(next) {
  if (customerUser) return true;
  rememberDestination(next);
  window.history.replaceState(null, '', '#login');
  authPage();
  return false;
}

function cartPage() {
  const items = cart.map(book).filter(Boolean);
  const selectedItems = items.filter(item => selected.has(item.id));
  const total = selectedItems.reduce((sum, item) => sum + item.price, 0);
  setView(`${pageHead('ตะกร้าสินค้า', 'ตรวจสอบรายการหนังสือก่อนดำเนินการชำระเงิน')}<section class="white-panel cart-panel">${items.length ? `<div class="cart-layout"><div class="cart-list">${items.map(item => `<div class="cart-row"><input type="checkbox" class="cart-check" aria-label="เลือก ${esc(item.title)}" data-select="${esc(item.id)}" ${selected.has(item.id) ? 'checked' : ''}><div class="cart-cover">${cover(item)}</div><div class="cart-copy"><h2>${esc(item.title)}</h2><p>${esc(item.subtitle)}</p><p>${esc(item.description)}</p><strong>${money(item.price)}</strong></div><button type="button" class="remove-button" aria-label="นำ ${esc(item.title)} ออกจากตะกร้า" data-remove="${esc(item.id)}">×</button></div>`).join('')}</div><div class="cart-sidebar"><div class="cart-total-box"><span class="cart-total-label">ราคารวม</span><strong class="cart-total-price">${money(total)}</strong><a class="pill-button dark ${selectedItems.length ? '' : 'disabled'}" href="${selectedItems.length ? '#checkout' : '#cart'}" ${selectedItems.length ? '' : 'aria-disabled="true"'}>ชำระเงินจำลอง →</a></div></div></div>` : `<div class="empty-state"><p>ยังไม่มีสินค้าในตะกร้า</p><a class="pill-button dark" href="#catalog">เลือกดู E-book</a></div>`}</section>`, 'cart');
  document.querySelectorAll('[data-select]').forEach(input => input.addEventListener('change', event => { const id = event.currentTarget.dataset.select; if (event.currentTarget.checked) selected.add(id); else selected.delete(id); cartPage(); }));
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', event => { const id = event.currentTarget.dataset.remove; cart = cart.filter(item => item !== id); selected.delete(id); saveCart(); cartPage(); }));
}

function checkout(singleId = '') {
  if (!requireLogin(singleId ? `#checkout/${singleId}` : '#checkout')) return;
  const ids = singleId ? [singleId] : cart.filter(id => selected.has(id));
  const items = ids.map(book).filter(Boolean);
  if (!items.length) return cartPage();
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const buyerName = getUserDisplayName(customerUser, profileData);
  setView(`<button class="back-link" type="button" data-back-fallback="${singleId ? `#book/${esc(singleId)}` : '#cart'}">← ย้อนกลับ</button>${pageHead('การชำระสินค้า')}
    <section class="white-panel checkout-panel"><div class="checkout-title"><div><div class="kicker">CHECKOUT / DEMO</div><h2>ยืนยันคำสั่งซื้อ</h2></div><span class="status-pill pending">ยังไม่ชำระ</span></div>${demo}
    <div class="checkout-columns"><div><h3>รายการสินค้า</h3>${items.map(item => `<div class="checkout-item"><div class="checkout-cover">${cover(item)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)}</p><b>${money(item.price)}</b></div></div>`).join('')}<div class="checkout-total"><span>ยอดรวมจำลอง</span><strong>${money(total)}</strong></div></div>
    <div><h3>ข้อมูลสำหรับรับหนังสือ</h3><form id="checkout-form"><label for="buyer-name">ชื่อผู้สั่งซื้อ</label><input id="buyer-name" name="name" minlength="2" maxlength="80" autocomplete="name" required value="${esc(buyerName)}" placeholder="ชื่อผู้สั่งซื้อ"><label for="buyer-email">อีเมลบัญชี</label><input id="buyer-email" name="email" type="email" value="${esc(customerUser.email)}" readonly><p class="field-note">หนังสือและคำสั่งซื้อจะผูกกับอีเมลบัญชีนี้</p><div id="live-message" aria-live="polite"></div><button class="pill-button dark wide" type="submit">สร้างคำสั่งซื้อ PENDING</button></form></div></div></section>`, 'orders');
  document.querySelector('#checkout-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true;
    document.querySelector('#live-message').innerHTML = '';
    try {
      const { order } = await api('orders', { bookIds: ids, name: form.elements.namedItem('name').value });
      currentOrder = order; customerEmail = order.email;
      cart = cart.filter(id => !ids.includes(id)); ids.forEach(id => selected.delete(id)); saveCart();
      window.history.replaceState(null, '', `#order/${order.id}`); orderPage(order.id);
    } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function pendingPayment(order, items) {
  setView(`${pageHead('การชำระสินค้า')}<section class="white-panel mock-payment-panel">${demo}<div class="kicker">PAYMENT / DEMO</div><h2>เลือกการชำระสินค้า</h2><div class="mock-methods" role="group" aria-label="ตัวเลือกการชำระเงินจำลอง"><button type="button" data-mock-method="card" aria-pressed="false">บัตรเครดิต</button><button type="button" data-mock-method="qr" class="active" aria-pressed="true">QR PromptPay</button></div><div class="mock-payment-grid"><div><h3>อีเมลสำหรับจัดส่งสินค้า</h3><div class="mock-readonly">${esc(order.email)}</div><h3>เลขคำสั่งซื้อ</h3><div class="mock-readonly order-number">${esc(order.id)}</div><p class="mock-payment-summary">${items.map(item => esc(item.title)).join(' · ')}<br><strong>ยอดรวมจำลอง ${money(order.price)}</strong></p></div><div class="mock-payment-explain"><span class="mock-symbol" aria-hidden="true">◎</span><h3>QR PromptPay (ตัวอย่าง)</h3><p id="mock-method-note">ไม่มี QR สำหรับรับเงินจริง กด “จำลองชำระเงินสำเร็จ” เพื่อทดสอบขั้นตอนถัดไป</p></div></div></section><div class="mock-payment-actions"><a class="pill-button light" href="#track">ชำระสินค้าในภายหลัง</a><button class="pill-button light" id="pay-button" type="button">จำลองชำระเงินสำเร็จ</button><button class="pill-button mock-cancel" id="cancel-button" type="button">ยกเลิกการชำระ</button></div><div id="live-message" class="mock-payment-message" aria-live="polite"></div>`, 'orders');
  document.querySelectorAll('[data-mock-method]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-mock-method]').forEach(option => { const active = option === button; option.classList.toggle('active', active); option.setAttribute('aria-pressed', String(active)); });
    const isCard = button.dataset.mockMethod === 'card';
    document.querySelector('.mock-payment-explain h3').textContent = isCard ? 'บัตรเครดิต (ตัวอย่าง)' : 'QR PromptPay (ตัวอย่าง)';
    document.querySelector('#mock-method-note').textContent = isCard ? 'ระบบนี้ไม่รับข้อมูลบัตรจริง กด “จำลองชำระเงินสำเร็จ” เพื่อทดสอบขั้นตอนถัดไป' : 'ไม่มี QR สำหรับรับเงินจริง กด “จำลองชำระเงินสำเร็จ” เพื่อทดสอบขั้นตอนถัดไป';
  }));
  document.querySelector('#pay-button').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังอัปเดต…';
    try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); }
    catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'จำลองชำระเงินสำเร็จ'; }
  });
  document.querySelector('#cancel-button').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { const data = await api('cancel', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); }
    catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; }
  });
}

function orderPage(id) {
  if (!requireLogin(`#order/${id}`)) return;
  if (!currentOrder || currentOrder.id !== id) {
    setView('<div class="loading">กำลังโหลดคำสั่งซื้อ…</div>', 'track');
    api('order', { id }).then(data => {
      if (location.hash !== `#order/${id}`) return;
      currentOrder = data.order;
      customerEmail = data.order.email;
      orderPage(id);
    }).catch(error => {
      if (location.hash === `#order/${id}`) setView(`<section class="white-panel empty-state">${notice(error.message)}<a class="pill-button dark" href="#track">กลับหน้าติดตาม</a></section>`, 'track');
    });
    return;
  }
  const order = currentOrder;
  const paid = order.status === 'PAID';
  const cancelled = order.status === 'CANCELLED';
  const status = statusInfo(order);
  const items = order.items?.length ? order.items : [book(order.bookId)].filter(Boolean);
  if (!paid && !cancelled) return pendingPayment(order, items);
  const deliveryText = { SENT: 'ส่งอีเมลลิงก์ดาวน์โหลดแล้ว โปรดตรวจกล่องจดหมายและอีเมลขยะ', DEMO: 'โหมดทดสอบในเครื่อง: แสดงลิงก์ดาวน์โหลดแทนการส่งอีเมลจริง', FAILED: 'คำสั่งซื้อสำเร็จแล้ว แต่ระบบยังไม่สามารถส่งอีเมลได้ กรุณาเปิดหน้าคำสั่งซื้อเพื่อเข้าถึง E-Book ของคุณ', NOT_CONFIGURED: 'ระบบยังไม่สามารถส่งอีเมลได้ในขณะนี้ กรุณาใช้ลิงก์ด้านล่างเพื่อเข้าถึง E-Book ได้ทันที', NOT_SENT: 'ยังไม่ได้ส่งอีเมล ใช้ลิงก์ด้านล่างเพื่อเข้าถึง E-Book ได้ทันที' }[order.emailStatus];
  setView(`${orderTabs('track')}${pageHead(paid ? '✓ คำสั่งซื้อเสร็จสมบูรณ์' : cancelled ? 'ยกเลิกคำสั่งซื้อแล้ว' : 'รอชำระสินค้า')}
    <section class="white-panel status-panel"><div class="status-panel-head"><div><div class="kicker">ORDER STATUS</div><h2>คำสั่งซื้อ ${esc(order.id)}</h2></div><span class="status-pill ${status.className}">${status.short}</span></div>${demo}<div class="status-id"><span>เลขคำสั่งซื้อ</span><strong>${esc(order.id)}</strong><button class="small-action" type="button" id="copy-id">คัดลอก</button></div><div class="status-items"><h3>รายละเอียดสินค้า</h3>${items.map(item => `<div class="status-item"><div class="status-cover">${cover(item)}</div><div><strong>${esc(item.title)}</strong><p>${esc(item.subtitle)}</p><b>${money(item.price)}</b></div></div>`).join('')}</div><div class="status-facts"><div><span>ยอดรวมจำลอง</span><strong>${money(order.price)}</strong></div><div><span>อีเมลรับหนังสือ</span><strong>${esc(order.email)}</strong></div></div>${paid ? `<div class="delivery-panel"><h3>การส่งมอบ</h3><p>${esc(deliveryText || 'กำลังตรวจผลการส่งอีเมล')}</p>${items.map(item => order.downloadUrls?.[item.id] || (items.length === 1 ? order.downloadUrl : '') ? `<a href="${esc(order.downloadUrls?.[item.id] || order.downloadUrl)}" target="_blank" rel="noopener">ดาวน์โหลด ${esc(item.title)} ↗</a>` : '').join('')}${['FAILED', 'NOT_CONFIGURED', 'NOT_SENT'].includes(order.emailStatus) ? '<button class="pill-button outline" type="button" id="retry-email-button">ลองส่งอีเมลอีกครั้ง</button>' : ''}<small>ลิงก์ใช้ได้ 24 ชั่วโมง ควรเปิดในเบราว์เซอร์หรือแอปอีเมล</small></div>` : cancelled ? `<div class="cancelled-panel">คำสั่งซื้อนี้ถูกยกเลิกแล้ว ไม่มีการส่งลิงก์ดาวน์โหลด</div>` : `<div class="payment-demo"><div><h3>ชำระเงินจำลอง</h3><p>กดปุ่มเพื่อเปลี่ยนสถานะเป็น PAID และทดสอบการส่งมอบหนังสือ</p></div><div class="payment-actions"><button class="pill-button dark" type="button" id="pay-button">จำลองชำระเงินสำเร็จ</button><button class="pill-button danger-outline" type="button" id="cancel-button">ยกเลิกคำสั่งซื้อ</button></div></div>`}<div id="live-message" aria-live="polite"></div></section>`, 'orders');
  document.querySelector('#copy-id').addEventListener('click', async () => { try { await navigator.clipboard.writeText(order.id); document.querySelector('#copy-id').textContent = 'คัดลอกแล้ว'; } catch {} });
  document.querySelector('#pay-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังอัปเดต…'; try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { try { const latest = await api('order', { id: order.id, email: customerEmail || order.email }); if (latest.order.status !== order.status) { currentOrder = latest.order; orderPage(order.id); return; } } catch {} document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'จำลองชำระเงินสำเร็จ'; } });
  document.querySelector('#retry-email-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; button.textContent = 'กำลังส่ง…'; try { const data = await api('pay', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; button.textContent = 'ลองส่งอีเมลอีกครั้ง'; } });
  document.querySelector('#cancel-button')?.addEventListener('click', async event => { const button = event.currentTarget; button.disabled = true; try { const data = await api('cancel', { id: order.id, email: customerEmail || order.email }); currentOrder = data.order; orderPage(order.id); } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; } });
}

async function track(prefill = '') {
  setView(`${orderTabs('track')}<section class="white-panel tracking-panel"><div class="tracking-heading"><h1>รายการการสั่งซื้อทั้งหมด</h1><button class="tracking-lookup-trigger" id="open-track-search" type="button" aria-label="ค้นหาคำสั่งซื้อด้วยเลขคำสั่งซื้อและอีเมล" aria-haspopup="dialog" aria-controls="track-search-dialog"><span class="tracking-search-label">ค้นหา<span class="tracking-search-extra">คำสั่งซื้อ</span></span><span class="tracking-search-icon" aria-hidden="true"></span></button></div><p class="tracking-note">${customerUser ? `คำสั่งซื้อของ ${esc(customerUser.email)}` : 'ค้นหาสถานะด้วยเลขคำสั่งซื้อและอีเมล'} · การชำระเงินเป็นระบบจำลอง</p><div id="track-message" aria-live="polite"></div><div id="tracking-list" class="tracking-list"><div class="loading">กำลังโหลดรายการ…</div></div>
    <dialog class="track-dialog" id="track-search-dialog" aria-labelledby="track-dialog-title"><div class="track-dialog-head"><div><div class="kicker">FIND YOUR ORDER</div><h2 id="track-dialog-title">ค้นหาคำสั่งซื้อ</h2><p>กรอกเลขคำสั่งซื้อและอีเมลที่ใช้สั่งซื้อ</p></div><button class="track-dialog-close" id="close-track-search" type="button" aria-label="ปิดหน้าต่างค้นหา">×</button></div><form id="track-form"><label for="track-id">เลขคำสั่งซื้อ</label><input id="track-id" name="id" required maxlength="27" value="${esc(prefill)}" placeholder="เลขคำสั่งซื้อ" autofocus><label for="track-email">อีเมลที่ใช้สั่งซื้อ</label><input id="track-email" name="email" type="email" required maxlength="254" value="${esc(customerUser?.email || '')}" ${customerUser ? 'readonly' : ''} placeholder="Email"><div id="live-message" aria-live="polite"></div><div class="track-dialog-actions"><button class="pill-button outline" id="cancel-track-search" type="button">ปิด</button><button class="pill-button dark" type="submit">ดูสถานะคำสั่งซื้อ</button></div></form></dialog></section>`, 'track');
  const dialog = document.querySelector('#track-search-dialog');
  document.querySelector('#open-track-search').addEventListener('click', () => dialog.showModal());
  document.querySelector('#close-track-search').addEventListener('click', () => dialog.close());
  document.querySelector('#cancel-track-search').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  if (prefill) dialog.showModal();
  document.querySelector('#track-form').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type=submit]'); button.disabled = true; try { const data = await api('order', { id: form.elements.namedItem('id').value.trim().toUpperCase(), email: form.elements.namedItem('email').value.trim() }); dialog.close(); if (customerUser) { currentOrder = data.order; customerEmail = data.order.email; location.hash = `#order/${data.order.id}`; orderPage(data.order.id); } else { document.querySelector('#tracking-list').innerHTML = orderRow(data.order, 'guest'); } } catch (error) { document.querySelector('#live-message').innerHTML = notice(error.message); button.disabled = false; } });
  const list = document.querySelector('#tracking-list');
  if (!customerUser) { list.innerHTML = '<div class="empty-state"><p>กรอกเลขคำสั่งซื้อและอีเมลเพื่อดูสถานะ</p></div>'; return; }
  let orders;
  try { orders = await sessionOrders(); }
  catch (error) { if (list.isConnected) list.innerHTML = notice(error.message); return; }
  if (!list.isConnected) return;
  list.innerHTML = orders.length ? orders.map(order => orderRow(order)).join('') : `<div class="empty-state"><p>ยังไม่มีประวัติการสั่งซื้อ</p></div>`;
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

async function orderHistory() {
  if (!requireLogin('#history')) return;
  setView(`${orderTabs('history')}<section class="white-panel tracking-panel history-panel"><h1>ประวัติการสั่งซื้อทั้งหมด</h1><p class="tracking-note">คำสั่งซื้อของ ${esc(customerUser.email)}</p><div id="history-list" class="tracking-list"><div class="loading">กำลังโหลดรายการ…</div></div></section>`, 'orders');
  const list = document.querySelector('#history-list');
  let orders;
  try { orders = await sessionOrders(); }
  catch (error) { if (list.isConnected) list.innerHTML = notice(error.message); return; }
  if (!list.isConnected) return;
  list.innerHTML = orders.length ? orders.map(order => orderRow(order, 'history')).join('') : `<div class="empty-state"><p>ยังไม่มีประวัติการสั่งซื้อ</p></div>`;
  bindOpenOrders(list, orders);
}

async function logoutCustomer(button) {
  button.disabled = true;
  try {
    await api('customer', { action: 'logout' });
    customerUser = null;
    currentOrder = null;
    customerEmail = '';
    rememberDestination('#catalog');
    profileData = { name: '', firstName: '', lastName: '', email: '' };
    writeSession('safe-profile', profileData);
    window.history.replaceState(null, '', '#login');
    authPage();
  } catch (error) {
    const message = document.querySelector('#live-message');
    if (message) message.innerHTML = notice(error.message);
    else {
      document.querySelector('.nav-notice')?.remove();
      const banner = document.createElement('div');
      banner.className = 'nav-notice';
      banner.setAttribute('role', 'alert');
      banner.textContent = error.message;
      document.querySelector('.site-header').after(banner);
    }
  } finally { button.disabled = false; }
}

function profileHeaderName(user, profile) {
  const merged = { ...profile, ...user };
  const names = normalizeUserNames(merged);
  return names.fullName || user?.username || 'สมาชิก SAFE MODE SHOP';
}

function profile(feedback = null) {
  if (!customerUser) return requireLogin('#profile');
  const names = normalizeUserNames({ ...profileData, ...customerUser });
  const firstVal = names.firstName;
  const lastVal = names.lastName;
  const headerName = profileHeaderName(customerUser, profileData);

  setView(`${pageHead('บัญชีของฉัน', 'จัดการโปรไฟล์และตั้งค่าบัญชีของคุณ')}
    <section class="white-panel dashboard-panel">
      <div class="dashboard-header">
        <div class="dashboard-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
        <div class="dashboard-meta">
          <h2>${esc(headerName)}</h2>
          <p>${esc(customerUser.email)}</p>
        </div>
      </div>
      <div class="dashboard-body">
        <div class="dashboard-section">
          <h3>ข้อมูลทั่วไป</h3>
          <form id="profile-form" class="profile-form">
            <div class="form-group">
              <label for="profile-username">Username</label>
              <input id="profile-username" name="username" value="${esc(customerUser.username || '')}" ${customerUser.username ? 'readonly' : 'required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}"'} placeholder="Username">
              ${customerUser.username ? '' : '<p class="field-note">ตั้ง Username สำหรับเข้าสู่ระบบ (3–24 ตัว ใช้ a-z, 0-9 หรือ _)</p>'}
            </div>
            <div class="form-group">
              <label for="profile-first">ชื่อ</label>
              <input id="profile-first" name="first" autocomplete="given-name" value="${esc(firstVal)}" placeholder="ชื่อ">
            </div>
            <div class="form-group">
              <label for="profile-last">นามสกุล</label>
              <input id="profile-last" name="last" autocomplete="family-name" value="${esc(lastVal)}" placeholder="นามสกุล">
            </div>
            <div class="form-group">
              <label for="profile-email">อีเมล</label>
              <input id="profile-email" name="email" type="email" value="${esc(customerUser.email)}" readonly placeholder="อีเมล">
            </div>
            <div id="live-message" aria-live="polite">${feedback ? notice(feedback.text, feedback.kind) : ''}</div>
            <div class="dashboard-actions">
              <button class="pill-button dark" type="submit">บันทึกข้อมูล</button>
            </div>
          </form>
        </div>
        <div class="dashboard-sidebar">
          <h3>เมนูบัญชี</h3>
          <a class="dashboard-link" href="#history">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ประวัติการสั่งซื้อ
          </a>
          <a class="dashboard-link" href="#forgot-password">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg> เปลี่ยนรหัสผ่าน
          </a>
          <button class="dashboard-link danger" id="customer-logout" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> ออกจากระบบ
          </button>
        </div>
      </div>
    </section>`, 'profile');

  document.querySelector('#profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type=submit]');
    const first = form.elements.namedItem('first').value.trim();
    const last = form.elements.namedItem('last').value.trim();
    const usernameInput = form.elements.namedItem('username');
    const username = usernameInput ? usernameInput.value.trim() : '';

    if (!first) {
      document.querySelector('#live-message').innerHTML = notice('กรุณากรอกชื่อ');
      return;
    }
    button.disabled = true;
    button.textContent = 'กำลังบันทึก...';
    try {
      const payload = { action: 'update-profile', first, last };
      if (!customerUser.username && username) payload.username = username;
      const result = await api('customer', payload);
      customerUser = result.user;
      profileData = {
        name: result.user.name,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: customerUser.email
      };
      writeSession('safe-profile', profileData);
      const displayName = getUserDisplayName(customerUser, profileData);
      navAuthAction.setAttribute('aria-label', `บัญชีผู้ใช้: ${displayName || 'โปรไฟล์'}`);
      profile({ text: 'บันทึกข้อมูลเรียบร้อยแล้ว', kind: 'success' });
    } catch (error) {
      document.querySelector('#live-message').innerHTML = notice(error.message);
      button.disabled = false;
      button.textContent = 'บันทึกข้อมูล';
    }
  });
  document.querySelector('#customer-logout').addEventListener('click', event => logoutCustomer(event.currentTarget));
}

function notFound() { setView(`<section class="white-panel empty-state"><h1>ไม่พบหน้านี้</h1><a class="pill-button dark" href="#home">กลับหน้าแรก</a></section>`); }
let lastRoutedHash = null;
function route(force = false) {
  clearActiveFocus();
  if (!force && location.hash === lastRoutedHash) return;
  lastRoutedHash = location.hash;
  const [section, id] = location.hash.slice(1).split('/');
  if (!section || section === 'home') home();
  else if (section === 'catalog') catalog();
  else if (section === 'book') detail(id);
  else if (section === 'cart') cartPage();
  else if (section === 'checkout') checkout(id);
  else if (section === 'order') orderPage(id);
  else if (section === 'track') track();
  else if (section === 'history') orderHistory();
  else if (section === 'profile') profile();
  else if (section === 'login' || section === 'register') authPage(section);
  else if (section === 'forgot-password') forgotPage();
  else if (section === 'reset-password') resetPage();
  else notFound();
}
app.addEventListener('click', event => { const back = event.target.closest('[data-back-fallback]'); if (back) return goBack(back.dataset.backFallback); const login = event.target.closest('a[href="#login"]'); if (login && !customerUser && !/^#(?:login|register|forgot-password|reset-password)/.test(location.hash)) rememberDestination(location.hash || '#home'); const add = event.target.closest('[data-add]'); if (add) addToCart(add.dataset.add); });
app.addEventListener('error', event => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('book-cover')) return;
  const fallback = document.createElement('div');
  fallback.className = 'book-cover fallback-cover';
  fallback.textContent = img.alt.replace(/^ปกหนังสือ\s*/, '');
  img.replaceWith(fallback);
}, true);
navAuthAction.addEventListener('click', () => { if (customerUser) { location.hash = '#profile'; profile(); } else { rememberDestination(location.hash || '#home'); location.hash = '#login'; authPage(); } });
try {
  const [catalog, session] = await Promise.all([api('books'), api('customer?view=session')]);
  books = catalog.books;
  customerUser = session.user;
  if (customerUser) {
    profileData = { name: customerUser.name || '', firstName: customerUser.firstName || '', lastName: customerUser.lastName || '', email: customerUser.email };
    writeSession('safe-profile', profileData);
  }
  cart = cart.filter(id => book(id));
  selected = new Set(cart);
  refreshCartCount();
  window.addEventListener('hashchange', () => route());
  window.addEventListener('popstate', () => route());
  window.addEventListener('pageshow', event => { clearActiveFocus(); if (event.persisted) route(true); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') clearActiveFocus(); });
  if (/^#(access_token|error=|error_code=)/.test(location.hash)) {
    const params = new URLSearchParams(location.hash.slice(1));
    const failed = params.has('error');
    const recovery = params.get('type') === 'recovery' && params.has('access_token');
    resetToken = recovery ? params.get('access_token') : '';
    window.history.replaceState(null, '', recovery ? '#reset-password' : '#login');
    if (recovery) resetPage();
    else authPage('login', failed ? 'ลิงก์ยืนยันหมดอายุหรือไม่ถูกต้อง' : 'ยืนยันอีเมลแล้ว กรุณาเข้าสู่ระบบ');
  } else if (location.hash.startsWith('#reset-password?token=')) {
    resetToken = new URLSearchParams(location.hash.split('?')[1]).get('token') || '';
    window.history.replaceState(null, '', '#reset-password');
    resetPage();
  } else route(true);
}
catch (error) { app.innerHTML = `<section class="white-panel empty-state">${notice(error.message)}</section>`; }
