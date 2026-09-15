const app = document.querySelector('#app');
let data = { books: [], orders: [], customers: [], emailConfigured: false };
let view = 'overview';
let query = '';
let statusFilter = 'ALL';

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
  app.innerHTML = `<div class="admin-auth-layout"><div class="admin-auth-side"><a class="brand" href="/" aria-label="SAFE MODE SHOP หน้าร้าน"><img src="/assets/safe-mode-shop-white.png" alt="SAFE MODE SHOP"></a><div class="admin-auth-hero"><span class="eyebrow">ADMIN WORKSPACE</span><h1>ระบบผู้ดูแลร้าน</h1><p>จัดการหนังสือ คำสั่งซื้อ และข้อมูลร้านจากพื้นที่เดียว</p></div><a href="/" class="pill-button outline">กลับหน้าร้าน</a></div><div class="admin-auth-main"><form class="login-card" id="login-form"><h2>เข้าสู่ระบบ</h2><p class="muted">กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน</p><label for="password">รหัสผ่านผู้ดูแล</label><input class="field" id="password" type="password" autocomplete="current-password" required autofocus placeholder="Password"><button class="primary" type="submit">เข้าสู่หลังบ้าน</button><div class="error" id="login-error" role="alert">${configured ? '' : 'ยังไม่ได้ตั้งค่ารหัสผู้ดูแลบนเซิร์ฟเวอร์'}</div></form></div></div>`;
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
  return `<div class="metrics"><div class="metric"><span>คำสั่งซื้อทั้งหมด</span><strong>${data.orders.length}</strong><small>รายการล่าสุดสูงสุด 100 รายการ</small></div><div class="metric alert"><span>รอชำระ</span><strong>${pending}</strong><small>ระบบชำระเงินจำลอง</small></div><div class="metric"><span>ชำระแล้ว</span><strong>${paid}</strong><small>พร้อมดาวน์โหลด E-book</small></div><div class="metric"><span>หนังสือที่เปิดขาย</span><strong>${active}</strong><small>จากทั้งหมด ${data.books.length} เล่ม · ลูกค้า ${data.customers.length} บัญชี</small></div></div>`;
}

function orderTable(limit) {
  const filtered = data.orders.filter(order => (statusFilter === 'ALL' || order.status === statusFilter) && `${order.id} ${order.customerName} ${order.email}`.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
  if (!filtered.length) return `<div class="empty">${query ? 'ไม่พบคำสั่งซื้อที่ค้นหา' : 'ยังไม่มีคำสั่งซื้อ'}</div>`;
  return `<div class="admin-order-list">${filtered.map(order => `<article class="admin-order-row"><div class="admin-cover">${order.items[0]?.cover ? `<img src="${escapeHtml(order.items[0].cover)}" alt="" loading="lazy">` : ''}</div><div class="admin-order-copy"><h3>${escapeHtml(order.items[0]?.title || 'รายการหนังสือ')}${order.items.length > 1 ? ` และอีก ${order.items.length - 1} เล่ม` : ''}</h3><p>${escapeHtml(order.customerName)} · ${escapeHtml(order.email)}</p><p class="order-id">${escapeHtml(order.id)} · ${formatDate(order.createdAt)}</p><strong>${order.price} บาท</strong></div><div class="admin-order-side"><span class="pill ${order.status.toLowerCase()}">${statusText(order.status)}</span><span class="email-state">${emailText(order.emailStatus)}</span><div class="row-actions"><button class="mini" data-action="view-order" data-id="${escapeHtml(order.id)}">รายละเอียด</button>${order.status === 'PENDING' ? `<button class="mini" data-action="mark-paid" data-id="${escapeHtml(order.id)}">จำลองชำระ</button><button class="mini danger" data-action="cancel-order" data-id="${escapeHtml(order.id)}">ยกเลิก</button>` : order.status === 'PAID' && order.emailStatus !== 'SENT' && data.emailConfigured ? `<button class="mini" data-action="retry-email" data-id="${escapeHtml(order.id)}">ลองส่งอีเมล</button>` : ''}</div></div></article>`).join('')}</div>`;
}

function booksPanel() {
  return `<section class="panel"><div class="panel-head"><div><h2>จัดการหนังสือ</h2><p>เพิ่ม แก้ไข ราคา และเปิดหรือซ่อนหนังสือจากหน้าร้าน</p></div><button class="primary" data-action="add-book">+ เพิ่มหนังสือ</button></div><div class="catalog-grid">${data.books.map(book => `<article class="book"><img src="${escapeHtml(book.cover || '/assets/covers/default-book-cover.svg')}" alt="" loading="lazy"><div><h3>${escapeHtml(book.title)}</h3><p>${escapeHtml(book.subtitle)}</p><strong>${book.price} บาท</strong><span class="pill ${book.active ? 'paid' : 'cancelled'}">${book.active ? 'เปิดขาย' : 'ซ่อนจากร้าน'}</span><br><button class="mini" data-action="edit-book" data-id="${escapeHtml(book.id)}">แก้ไข</button> <button class="mini" data-action="set-book-active" data-id="${escapeHtml(book.id)}" data-active="${!book.active}">${book.active ? 'ซ่อนหนังสือ' : 'เปิดขาย'}</button> <button class="mini danger" data-action="delete-book" data-id="${escapeHtml(book.id)}" title="ลบหนังสือ">ลบ</button></div></article>`).join('')}</div></section>`;
}

function customersPanel() {
  return `<section class="panel"><div class="panel-head"><div><h2>บัญชีลูกค้า</h2><p>ข้อมูลนี้แสดงเฉพาะผู้ดูแลร้าน</p></div></div><div class="customer-list">${data.customers.length ? data.customers.map(item => {
    const fullName = (item.firstName && item.lastName) ? `${item.firstName} ${item.lastName}` : (item.name || item.username || 'ลูกค้า');
    return `<article class="customer-row"><div class="customer-avatar" aria-hidden="true">${escapeHtml((item.username || item.email)[0].toUpperCase())}</div><div><h3>${escapeHtml(item.username || 'ยังไม่มี Username')}</h3><p><strong>ชื่อ-นามสกุล:</strong> ${escapeHtml(fullName)}${item.firstName ? ` (ชื่อ: ${escapeHtml(item.firstName)}, นามสกุล: ${escapeHtml(item.lastName)})` : ''}</p><p><strong>อีเมล:</strong> ${escapeHtml(item.email)}</p><small>${item.createdAt ? `สมัครเมื่อ ${formatDate(item.createdAt)}` : 'บัญชีทดสอบในเครื่อง'}</small></div></article>`;
  }).join('') : '<div class="empty">ยังไม่มีบัญชีลูกค้า</div>'}</div></section>`;
}

function showDialog(html) {
  document.querySelector('.admin-dialog')?.remove();
  const dialog = document.createElement('dialog');
  dialog.className = 'admin-dialog';
  dialog.innerHTML = html;
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener('click', event => { if (event.target === dialog || event.target.closest('[data-close-dialog]')) dialog.close(); });
  dialog.addEventListener('close', () => dialog.remove());
  return dialog;
}

function showOrder(id) {
  const order = data.orders.find(item => item.id === id);
  if (!order) return toast('ไม่พบคำสั่งซื้อ', true);
  showDialog(`<div class="dialog-head"><h2>รายละเอียดคำสั่งซื้อ</h2><button type="button" data-close-dialog aria-label="ปิด">×</button></div><p class="order-id">${escapeHtml(order.id)} <button class="mini" id="copy-order-id" type="button">คัดลอกเลข</button></p><p>${escapeHtml(order.customerName)} · ${escapeHtml(order.email)}</p><p>สร้างเมื่อ ${formatDate(order.createdAt)} · สถานะ ${statusText(order.status)} · ${emailText(order.emailStatus)}</p><div class="dialog-items">${order.items.map(item => `<div><img src="${escapeHtml(item.cover || '/assets/covers/default-book-cover.svg')}" alt="" loading="lazy"><span>${escapeHtml(item.title)}</span><strong>${item.price} บาท</strong></div>`).join('')}</div><p class="dialog-total">ยอดรวมจำลอง <strong>${order.price} บาท</strong></p><button class="mini" data-close-dialog type="button">ปิด</button>`);
  document.querySelector('#copy-order-id').addEventListener('click', async () => { try { await navigator.clipboard.writeText(order.id); toast('คัดลอกเลขคำสั่งซื้อแล้ว'); } catch { toast('คัดลอกไม่สำเร็จ', true); } });
}

function openBookModal(mode = 'create', book = null) {
  const isCreate = mode === 'create';
  const title = isCreate ? 'เพิ่มหนังสือ' : 'แก้ไขหนังสือ';
  const submitText = isCreate ? 'เพิ่มหนังสือ' : 'บันทึกหนังสือ';
  const loadingText = isCreate ? 'กำลังเพิ่มหนังสือ...' : 'กำลังบันทึกข้อมูล...';

  const defaultCoverUrl = '/assets/covers/default-book-cover.svg';

  // Determine label for current cover in edit mode
  let currentCoverBadge = 'หน้าปกเริ่มต้นของเว็บไซต์';
  if (!isCreate && book?.cover) {
    if (book.cover === defaultCoverUrl || book.cover.includes('default-book-cover')) {
      currentCoverBadge = 'หน้าปกเริ่มต้นของเว็บไซต์';
    } else if (book.cover.includes('-auto.')) {
      currentCoverBadge = 'สร้างจากหน้าแรกอัตโนมัติ';
    } else {
      currentCoverBadge = 'อัปโหลดหน้าปกเอง (เฉพาะเล่ม)';
    }
  }

  const html = `
    <div class="dialog-head">
      <h2>${title}</h2>
      <button type="button" data-close-dialog aria-label="ปิด">×</button>
    </div>
    <form id="book-form">
      <label>
        ไฟล์ E-Book ${isCreate ? '<span class="req">*</span>' : ''}
        ${!isCreate && (book?.fileName || book?.file) ? `
          <div class="current-file-box">
            ไฟล์ปัจจุบัน: <strong>${escapeHtml(book.fileName || book.file)}</strong>
          </div>` : ''}
        <input name="file" id="book-file-input" type="file" class="field file-field" accept=".pdf,.epub,.docx,.zip,.mobi,.txt" ${isCreate ? 'required' : ''}>
        <small class="field-hint">รองรับไฟล์ .pdf, .epub, .docx, .zip (สูงสุด 50MB)${!isCreate ? ' · เลือกไฟล์ใหม่หากต้องการเปลี่ยนไฟล์ E-Book' : ''}</small>
      </label>

      ${!isCreate ? `
        <div class="current-cover-section">
          <label>หน้าปกปัจจุบัน</label>
          <div class="current-cover-card">
            <img class="current-cover-thumb" src="${escapeHtml(book?.cover || defaultCoverUrl)}" alt="หน้าปกปัจจุบัน">
            <div class="current-cover-info">
              <strong>${escapeHtml(book?.title || 'หนังสือ')}</strong>
              <span class="cover-badge">${escapeHtml(currentCoverBadge)}</span>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="field-label-wrap" style="margin-top: 14px;">
        <label>${isCreate ? 'หน้าปกหนังสือ' : 'เปลี่ยนหน้าปก'}</label>
        <div class="cover-mode-group">
          ${!isCreate ? `
            <label class="cover-option-card">
              <input type="radio" name="cover_mode" value="keep" checked>
              <div class="cover-option-text">
                <strong>คงหน้าปกปัจจุบัน</strong>
                <small>ใช้หน้าปกเดิม ไม่เปลี่ยนแปลง</small>
              </div>
            </label>
          ` : ''}
          <label class="cover-option-card">
            <input type="radio" name="cover_mode" value="auto_first_page" ${isCreate ? 'checked' : ''}>
            <div class="cover-option-text">
              <strong>ใช้หน้าแรกของไฟล์</strong>
              <small>สร้างหน้าปกจากไฟล์ E-Book อัตโนมัติ (เฉพาะ PDF)</small>
            </div>
          </label>
          <label class="cover-option-card">
            <input type="radio" name="cover_mode" value="default">
            <div class="cover-option-text">
              <strong>ใช้หน้าปกเริ่มต้นของเว็บไซต์</strong>
              <small>ใช้ปกมาตรฐานของ SAFEMODE SHOP</small>
            </div>
          </label>
          <label class="cover-option-card">
            <input type="radio" name="cover_mode" value="custom">
            <div class="cover-option-text">
              <strong>อัปโหลดหน้าปกเอง</strong>
              <small>รองรับ JPG, PNG หรือ WebP (สูงสุด 5MB)</small>
            </div>
          </label>
        </div>
      </div>

      <div id="custom-cover-wrap" style="display: none; margin-top: 10px;">
        <label>
          เลือกรูปหน้าปก <span class="req">*</span>
          <input name="cover_file" id="custom-cover-input" type="file" class="field file-field" accept=".jpg,.jpeg,.png,.webp">
          <small class="field-hint">รองรับไฟล์ .jpg, .jpeg, .png, .webp (สูงสุด 5MB)</small>
        </label>
      </div>

      <div class="cover-preview-wrapper" id="cover-preview-box">
        <img class="cover-preview-img" id="cover-preview-img" src="${escapeHtml(!isCreate && book?.cover ? book.cover : defaultCoverUrl)}" alt="พรีวิวหน้าปก">
        <div class="cover-preview-meta">
          <strong id="cover-preview-title">${isCreate ? 'สร้างจากหน้าแรกอัตโนมัติ' : 'พรีวิว: คงหน้าปกปัจจุบัน'}</strong>
          <span id="cover-preview-desc">${isCreate ? 'ระบบจะสร้างรูปหน้าปกจากหน้าแรกของไฟล์ PDF โดยอัตโนมัติ' : 'ใช้รูปภาพหน้าปกเดิม ไม่มีการเปลี่ยนแปลง'}</span>
        </div>
      </div>

      <label style="margin-top: 16px;">
        ชื่อหนังสือ <span class="req">*</span>
        <input name="title" class="field" required minlength="3" maxlength="140" value="${escapeHtml(book?.title || '')}" placeholder="ชื่อหนังสือ">
      </label>
      <label>
        คำอธิบายสั้น <span class="req">*</span>
        <input name="subtitle" class="field" required minlength="3" maxlength="180" value="${escapeHtml(book?.subtitle || '')}" placeholder="คำอธิบายสั้น">
      </label>
      <label>
        รายละเอียด <span class="req">*</span>
        <textarea name="description" class="field textarea-field" required minlength="10" maxlength="1000" placeholder="รายละเอียด">${escapeHtml(book?.description || '')}</textarea>
      </label>
      <label>
        ผู้จัดทำ <span class="req">*</span>
        <input name="author" class="field" required minlength="2" maxlength="100" value="${escapeHtml(book?.author || 'นพนันท์ ศุภมาตร์')}" placeholder="ผู้จัดทำ">
      </label>
      <label>
        ราคาจำลอง (บาท) <span class="req">*</span>
        <input name="price" class="field" type="number" required min="1" max="100000" value="${book ? book.price : 99}" placeholder="ราคา">
      </label>
      <div id="book-form-error" class="error" role="alert"></div>
      <div class="dialog-actions">
        <button type="button" class="mini" data-close-dialog>ยกเลิก</button>
        <button type="submit" class="primary" id="book-submit-btn">${submitText}</button>
      </div>
    </form>
  `;

  const dialog = showDialog(html);
  const form = dialog.querySelector('#book-form');
  const errorEl = dialog.querySelector('#book-form-error');
  const submitBtn = dialog.querySelector('#book-submit-btn');
  const fileInput = dialog.querySelector('#book-file-input');
  const customWrap = dialog.querySelector('#custom-cover-wrap');
  const customInput = dialog.querySelector('#custom-cover-input');
  const previewImg = dialog.querySelector('#cover-preview-img');
  const previewTitle = dialog.querySelector('#cover-preview-title');
  const previewDesc = dialog.querySelector('#cover-preview-desc');

  let chosenCustomUrl = null;

  function updateCoverView() {
    const selectedMode = form.querySelector('input[name="cover_mode"]:checked')?.value || (isCreate ? 'auto_first_page' : 'keep');
    customWrap.style.display = selectedMode === 'custom' ? 'block' : 'none';

    if (selectedMode === 'keep') {
      previewImg.src = book?.cover || defaultCoverUrl;
      previewTitle.textContent = 'พรีวิว: คงหน้าปกปัจจุบัน';
      previewDesc.textContent = 'ใช้รูปภาพหน้าปกเดิม ไม่มีการเปลี่ยนแปลง';
    } else if (selectedMode === 'default') {
      previewImg.src = defaultCoverUrl;
      previewTitle.textContent = 'พรีวิว: หน้าปกเริ่มต้นของเว็บไซต์';
      previewDesc.textContent = 'ใช้รูปภาพมาตรฐานของ SAFEMODE SHOP';
    } else if (selectedMode === 'auto_first_page') {
      previewImg.src = defaultCoverUrl;
      previewTitle.textContent = 'พรีวิว: สร้างจากหน้าแรกอัตโนมัติ';
      const selectedPdf = fileInput?.files?.[0];
      if (selectedPdf && selectedPdf.name.toLowerCase().endsWith('.pdf')) {
        previewDesc.textContent = `ระบบจะดึงหน้าแรกของไฟล์ ${selectedPdf.name} มาเป็นหน้าปกเมื่อบันทึก`;
      } else if (!isCreate && book?.fileName?.toLowerCase()?.endsWith('.pdf')) {
        previewDesc.textContent = `ระบบจะดึงหน้าแรกของไฟล์ ${book.fileName} มาเป็นหน้าปกเมื่อบันทึก`;
      } else {
        previewDesc.textContent = 'ระบบจะดึงหน้าแรกของไฟล์ PDF มาเป็นหน้าปกเมื่อบันทึก (เฉพาะ PDF)';
      }
    } else if (selectedMode === 'custom') {
      if (chosenCustomUrl) {
        previewImg.src = chosenCustomUrl;
        previewTitle.textContent = 'พรีวิว: รูปภาพใหม่ที่เลือก';
        previewDesc.textContent = customInput.files[0]?.name || 'พร้อมบันทึกเป็นหน้าปก';
      } else {
        previewImg.src = defaultCoverUrl;
        previewTitle.textContent = 'ยังไม่ได้เลือกรูปภาพ';
        previewDesc.textContent = 'กรุณาเลือกไฟล์รูปภาพ .jpg, .png หรือ .webp (สูงสุด 5MB)';
      }
    }
  }

  form.querySelectorAll('input[name="cover_mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const selected = form.querySelector('input[name="cover_mode"]:checked')?.value;
      if (selected !== 'custom') {
        if (customInput) customInput.value = '';
        if (chosenCustomUrl) {
          URL.revokeObjectURL(chosenCustomUrl);
          chosenCustomUrl = null;
        }
      }
      errorEl.textContent = '';
      updateCoverView();
    });
  });

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const selectedMode = form.querySelector('input[name="cover_mode"]:checked')?.value;
      if (selectedMode === 'auto_first_page') updateCoverView();
    });
  }

  if (customInput) {
    customInput.addEventListener('change', () => {
      const file = customInput.files[0];
      if (!file) {
        if (chosenCustomUrl) {
          URL.revokeObjectURL(chosenCustomUrl);
          chosenCustomUrl = null;
        }
        updateCoverView();
        return;
      }
      if (file.size > 5242880) {
        errorEl.textContent = 'ไฟล์รูปหน้าปกมีขนาดใหญ่เกิน 5MB';
        customInput.value = '';
        if (chosenCustomUrl) {
          URL.revokeObjectURL(chosenCustomUrl);
          chosenCustomUrl = null;
        }
        updateCoverView();
        return;
      }
      errorEl.textContent = '';
      if (chosenCustomUrl) URL.revokeObjectURL(chosenCustomUrl);
      chosenCustomUrl = URL.createObjectURL(file);
      updateCoverView();
    });
  }

  dialog.addEventListener('close', () => {
    if (chosenCustomUrl) {
      URL.revokeObjectURL(chosenCustomUrl);
      chosenCustomUrl = null;
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.textContent = '';

    const selectedMode = form.querySelector('input[name="cover_mode"]:checked')?.value || (isCreate ? 'auto_first_page' : 'keep');
    if (selectedMode === 'custom') {
      if (!customInput.files || !customInput.files[0]) {
        errorEl.textContent = 'กรุณาเลือกไฟล์รูปหน้าปก';
        return;
      }
    }

    submitBtn.disabled = true;
    submitBtn.textContent = loadingText;

    try {
      const formData = new FormData(form);
      formData.append('action', isCreate ? 'add-book' : 'update-book');
      if (!isCreate) formData.append('id', book.id);

      if (!isCreate) {
        if (selectedMode === 'keep') {
          formData.delete('cover_mode');
          formData.delete('cover_file');
        } else if (selectedMode === 'default' || selectedMode === 'auto_first_page') {
          formData.set('cover_mode', selectedMode);
          formData.delete('cover_file');
        } else if (selectedMode === 'custom') {
          formData.set('cover_mode', 'custom');
        }
      } else {
        if (selectedMode !== 'custom') {
          formData.delete('cover_file');
        }
      }

      const response = await fetch('/api/admin', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || (isCreate ? 'ไม่สามารถอัปโหลดไฟล์ E-Book ได้ กรุณาลองใหม่' : 'ไม่สามารถบันทึกข้อมูลหนังสือได้'));
      }

      dialog.close();
      await load();
      if (result.notice) {
        toast(result.notice);
      } else {
        toast(isCreate ? 'เพิ่มหนังสือเรียบร้อยแล้ว' : 'บันทึกข้อมูลหนังสือแล้ว');
      }
    } catch (error) {
      errorEl.textContent = error.message;
      toast(error.message, true);
      submitBtn.disabled = false;
      submitBtn.textContent = submitText;
    }
  });
}

function render() {
  const title = { overview: 'ภาพรวมร้าน', orders: 'คำสั่งซื้อ', books: 'หนังสือ', customers: 'ลูกค้า' }[view];
  app.innerHTML = `<div class="admin-workspace"><aside class="admin-sidebar"><div class="admin-brand"><a class="brand" href="/" aria-label="SAFE MODE SHOP หน้าร้าน"><img src="/assets/brand/safemode-shop-dark.png" alt="SAFE MODE SHOP"></a><span class="admin-label">ADMIN PANEL</span></div><nav class="admin-nav" aria-label="เมนูผู้ดูแล"><div class="nav-group"><button data-view="overview" class="${view === 'overview' ? 'active' : ''}">ภาพรวม</button><button data-view="orders" class="${view === 'orders' ? 'active' : ''}">คำสั่งซื้อ</button><button data-view="books" class="${view === 'books' ? 'active' : ''}">หนังสือ</button><button data-view="customers" class="${view === 'customers' ? 'active' : ''}">ลูกค้า</button></div><div class="nav-bottom"><a href="/">กลับหน้าร้าน</a><button class="nav-exit" data-action="logout">ออกจากระบบ</button></div></nav></aside><main class="admin-main"><header class="admin-topbar"><div class="page-heading"><h1>${title}</h1></div><div class="content-actions"><span class="demo-badge">DEMO ONLY</span><button class="mini" data-action="refresh">รีเฟรช</button></div></header><div class="admin-content">${view === 'overview' ? `${metrics()}<section class="panel"><div class="panel-head"><div><h2>คำสั่งซื้อล่าสุด</h2><p>5 รายการล่าสุด</p></div><button class="mini" data-view="orders">ดูทั้งหมด →</button></div>${orderTable(5)}</section>` : view === 'orders' ? `<section class="panel"><div class="panel-head"><div><h2>ติดตามคำสั่งซื้อ</h2><p>แสดงสูงสุด 100 รายการล่าสุด</p></div><div class="order-filters"><select class="field" id="status-filter" aria-label="กรองสถานะ"><option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>ทุกสถานะ</option><option value="PENDING" ${statusFilter === 'PENDING' ? 'selected' : ''}>รอชำระ</option><option value="PAID" ${statusFilter === 'PAID' ? 'selected' : ''}>ชำระแล้ว</option><option value="CANCELLED" ${statusFilter === 'CANCELLED' ? 'selected' : ''}>ยกเลิกแล้ว</option></select><input class="field search" id="order-search" type="search" placeholder="ค้นหา" value="${escapeHtml(query)}" aria-label="ค้นหาคำสั่งซื้อ"></div></div><div id="order-results">${orderTable(100)}</div></section>` : view === 'books' ? booksPanel() : customersPanel()}</div></main></div>`;
  let searchTimeout;
  document.querySelector('#order-search')?.addEventListener('input', event => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      query = event.target.value;
      document.querySelector('#order-results').innerHTML = orderTable(100);
    }, 300);
  });
  document.querySelector('#status-filter')?.addEventListener('change', event => { statusFilter = event.target.value; document.querySelector('#order-results').innerHTML = orderTable(100); });
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
  if (action === 'view-order') return showOrder(target.dataset.id);
  if (action === 'add-book') return openBookModal('create');
  if (action === 'edit-book') {
    const book = data.books.find(b => b.id === target.dataset.id);
    if (!book) return toast('ไม่พบหนังสือ', true);
    return openBookModal('edit', book);
  }
  if (action === 'delete-book') {
    const book = data.books.find(b => b.id === target.dataset.id);
    if (!confirm(`ยืนยันการลบหนังสือ "${book ? book.title : target.dataset.id}"?`)) return;
  }
  target.disabled = true;
  try {
    if (action === 'refresh') { await load(); toast('อัปเดตข้อมูลล่าสุดแล้ว'); return; }
    if (action === 'logout') { await post({ action }); renderLogin(); return; }
    const input = { action, id: target.dataset.id };
    if (action === 'set-book-active') input.active = target.dataset.active === 'true';
    await post(input);
    await load();
    toast(action === 'set-book-active' ? 'อัปเดตหน้าร้านแล้ว' : action === 'delete-book' ? 'ลบหนังสือเรียบร้อยแล้ว' : action === 'cancel-order' ? 'ยกเลิกคำสั่งซื้อแล้ว' : action === 'mark-paid' ? 'บันทึกการชำระเงินจำลองแล้ว' : 'ดำเนินการส่งอีเมลแล้ว');
  } catch (error) { toast(error.message, true); if (error.status === 401) renderLogin(); }
  finally { target.disabled = false; }
});

try {
  const session = await api('?view=session');
  if (session.authenticated) await load(); else renderLogin(session.configured);
} catch (error) { renderLogin(); toast(error.message, true); }
