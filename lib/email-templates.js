/**
 * SAFEMODE SHOP - Email Templates & Shared Layout
 * Brand Voice: Polite, professional, friendly, concise, trustworthy.
 */

export function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatGreeting(name) {
  if (name && typeof name === 'string') {
    const trimmed = name.trim();
    if (trimmed && !/^(null|undefined|customer\s*user)$/i.test(trimmed)) {
      return `สวัสดีคุณ ${escapeHtml(trimmed)}`;
    }
  }
  return 'สวัสดี';
}

export function formatGreetingText(name) {
  if (name && typeof name === 'string') {
    const trimmed = name.trim();
    if (trimmed && !/^(null|undefined|customer\s*user)$/i.test(trimmed)) {
      return `สวัสดีคุณ ${trimmed}`;
    }
  }
  return 'สวัสดี';
}

export function formatPrice(price) {
  if (price == null || isNaN(price)) return '';
  return `${Number(price)} บาท`;
}

/**
 * Shared HTML Email Layout
 */
export function renderEmailLayout({
  title = 'SAFEMODE SHOP',
  heading = '',
  greeting = '',
  introText = '',
  orderInfo = null,
  bookItems = null,
  primaryCta = null, // { text, url }
  fallbackUrlText = '',
  noticeText = '',
  isDemo = true
}) {
  const safeHeading = escapeHtml(heading);
  const safeGreeting = greeting ? `<p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #111111;">${greeting}</p>` : '';
  const safeIntro = introText ? `<p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #333333;">${introText}</p>` : '';

  let orderBoxHtml = '';
  if (orderInfo && orderInfo.length > 0) {
    const rows = orderInfo.map(item => `
      <tr>
        <td style="padding: 6px 0; font-size: 14px; color: #666666; width: 140px; vertical-align: top;">${escapeHtml(item.label)}</td>
        <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: #111111; vertical-align: top;">${escapeHtml(item.value)}</td>
      </tr>
    `).join('');

    orderBoxHtml = `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; margin: 20px 0; padding: 16px 20px;">
        ${rows}
      </table>
    `;
  }

  let bookItemsHtml = '';
  if (bookItems && bookItems.length > 0) {
    const itemRows = bookItems.map(item => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">
          <div style="font-size: 15px; font-weight: 600; color: #111111;">${escapeHtml(item.title)}</div>
          ${item.price != null ? `<div style="font-size: 13px; color: #666666; margin-top: 2px;">ราคา ${formatPrice(item.price)}</div>` : ''}
        </td>
        ${item.downloadUrl ? `
        <td style="padding: 12px 0 12px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; text-align: right; white-space: nowrap;">
          <a href="${item.downloadUrl}" target="_blank" style="background-color: #111111; color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 50px; display: inline-block;">เปิด E-Book</a>
        </td>` : ''}
      </tr>
    `).join('');

    bookItemsHtml = `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0 24px;">
        ${itemRows}
      </table>
    `;
  }

  let ctaHtml = '';
  if (primaryCta && primaryCta.url && primaryCta.text) {
    ctaHtml = `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px auto 16px; text-align: center;">
        <tr>
          <td align="center" style="border-radius: 50px; background-color: #111111;">
            <a href="${primaryCta.url}" target="_blank" style="font-size: 15px; font-weight: 600; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 50px; display: inline-block;">
              ${escapeHtml(primaryCta.text)}
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  let fallbackHtml = '';
  if (fallbackUrlText) {
    fallbackHtml = `
      <p style="margin: 16px 0 0; font-size: 12px; color: #666666; line-height: 1.5; word-break: break-all;">
        หากปุ่มด้านบนใช้งานไม่ได้ คุณสามารถคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br>
        <span style="color: #111111; font-family: monospace;">${escapeHtml(fallbackUrlText)}</span>
      </p>
    `;
  }

  let noticeHtml = '';
  if (noticeText) {
    noticeHtml = `
      <div style="margin: 24px 0 16px; padding: 12px 16px; background-color: #f9fafb; border-left: 3px solid #111111; border-radius: 4px; font-size: 13px; color: #555555; line-height: 1.6;">
        ${noticeText}
      </div>
    `;
  }

  let demoHtml = '';
  if (isDemo) {
    demoHtml = `
      <div style="margin: 16px 0 8px; font-size: 11px; color: #888888; text-align: center; line-height: 1.4;">
        * รายการนี้เป็นส่วนหนึ่งของระบบสาธิต SAFEMODE SHOP (Demo Only - ไม่มีการเรียกเก็บเงินจริง)
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeHeading || 'SAFEMODE SHOP'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #111111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f5; padding: 28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 14px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid #f0f0f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <div style="font-size: 19px; font-weight: 800; letter-spacing: -0.02em; color: #111111;">SAFEMODE SHOP</div>
                    <div style="font-size: 11px; font-weight: 500; color: #888888; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 2px;">E-Book Store</div>
                  </td>
                  ${isDemo ? `<td align="right"><span style="background-color: #f3f4f6; color: #4b5563; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; border: 1px solid #e5e7eb;">DEMO</span></td>` : ''}
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              ${safeHeading ? `<h1 style="margin: 0 0 20px; font-size: 22px; font-weight: 700; color: #111111; letter-spacing: -0.01em;">${safeHeading}</h1>` : ''}
              ${safeGreeting}
              ${safeIntro}
              ${orderBoxHtml}
              ${bookItemsHtml}
              ${ctaHtml}
              ${fallbackHtml}
              ${noticeHtml}
              ${demoHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px 28px; background-color: #fafafa; border-top: 1px solid #f0f0f0;">
              <p style="margin: 0; font-size: 13px; color: #555555; line-height: 1.6;">
                ขอบคุณที่สนับสนุน <strong>SAFEMODE SHOP</strong><br>
                ศูนย์รวม E-Book และเอกสารคู่มือการพัฒนาซอฟต์แวร์
              </p>
              <p style="margin: 12px 0 0; font-size: 11px; color: #888888; line-height: 1.5;">
                อีเมลฉบับนี้ถูกส่งโดยอัตโนมัติจากระบบ SAFEMODE SHOP กรุณาไม่ตอบกลับอีเมลนี้
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Shared Plain Text Email Renderer
 */
export function renderEmailText({
  heading = '',
  greeting = '',
  introText = '',
  orderInfo = null,
  bookItems = null,
  primaryCta = null,
  fallbackUrlText = '',
  noticeText = '',
  isDemo = true
}) {
  const parts = [];
  parts.push('========================================');
  parts.push('SAFEMODE SHOP · E-Book Store');
  parts.push('========================================\n');

  if (heading) parts.push(heading + '\n');
  if (greeting) parts.push(greeting + '\n');
  if (introText) parts.push(introText + '\n');

  if (orderInfo && orderInfo.length > 0) {
    parts.push('----------------------------------------');
    parts.push('รายละเอียดคำสั่งซื้อ:');
    for (const item of orderInfo) {
      parts.push(`• ${item.label}: ${item.value}`);
    }
    parts.push('----------------------------------------\n');
  }

  if (bookItems && bookItems.length > 0) {
    parts.push('รายการ E-Book:');
    for (const book of bookItems) {
      parts.push(`• ${book.title}${book.price != null ? ` (${book.price} บาท)` : ''}`);
      if (book.downloadUrl) parts.push(`  ลิงก์เข้าถึง: ${book.downloadUrl}`);
    }
    parts.push('');
  }

  if (primaryCta && primaryCta.text && primaryCta.url) {
    parts.push(`▶ ${primaryCta.text}:`);
    parts.push(primaryCta.url + '\n');
  }

  if (fallbackUrlText && (!primaryCta || primaryCta.url !== fallbackUrlText)) {
    parts.push(`ลิงก์สำหรับเข้าถึง: ${fallbackUrlText}\n`);
  }

  if (noticeText) {
    parts.push(`หมายเหตุ: ${noticeText.replace(/<[^>]+>/g, '')}\n`);
  }

  if (isDemo) {
    parts.push('* รายการนี้เป็นส่วนหนึ่งของระบบสาธิต SAFEMODE SHOP (Demo Only - ไม่มีการเรียกเก็บเงินจริง)\n');
  }

  parts.push('----------------------------------------');
  parts.push('ขอบคุณที่สนับสนุน SAFEMODE SHOP');
  parts.push('อีเมลฉบับนี้ถูกส่งโดยอัตโนมัติจากระบบ SAFEMODE SHOP กรุณาไม่ตอบกลับอีเมลนี้');
  parts.push('========================================');

  return parts.join('\n');
}

/**
 * 1. E-Book Delivery & Payment Success Email
 * Sent upon successful payment or admin retry
 */
export function renderDeliveryEmail(order, books, downloadUrls, origin) {
  const items = Array.isArray(books) ? books : [books];
  const greeting = formatGreeting(order.customer_name);
  const greetingText = formatGreetingText(order.customer_name);
  const hasMultiple = items.length > 1;

  const total = order.price != null
    ? Number(order.price)
    : items.reduce((sum, b) => sum + (Number(b.price) || 0), 0);

  const orderInfo = [
    { label: 'หมายเลขคำสั่งซื้อ', value: `#${order.id}` },
    { label: 'ยอดรวม', value: `${total} บาท` },
    { label: 'สถานะ', value: 'ชำระเงินสำเร็จ (ระบบจำลอง)' }
  ];

  const bookItems = items.map(book => ({
    title: book.title,
    price: book.price,
    downloadUrl: downloadUrls[book.id] || null
  }));

  const singleBook = !hasMultiple ? items[0] : null;
  const primaryDownloadUrl = singleBook ? downloadUrls[singleBook.id] : null;

  const primaryCta = hasMultiple
    ? { text: 'ตรวจสอบคำสั่งซื้อทั้งหมด', url: `${origin}/#order/${order.id}` }
    : { text: 'เปิด E-Book ของฉัน', url: primaryDownloadUrl };

  const fallbackUrlText = !hasMultiple && primaryDownloadUrl ? primaryDownloadUrl : `${origin}/#order/${order.id}`;

  const noticeText = 'ลิงก์สำหรับเข้าถึง E-Book นี้มีระยะเวลาการใช้งานเพื่อความปลอดภัย หากลิงก์หมดอายุ ท่านสามารถเข้าสู่ระบบและเปิดดูคำสั่งซื้อจากหน้าเว็บไซต์เพื่อสร้างลิงก์ใหม่ได้ตลอดเวลา';

  const introText = hasMultiple
    ? `E-Book จากคำสั่งซื้อ #${order.id} ทั้งหมด ${items.length} เล่ม พร้อมให้คุณเข้าถึงและดาวน์โหลดแล้ว`
    : `E-Book จากคำสั่งซื้อ #${order.id} พร้อมให้คุณเข้าถึงและดาวน์โหลดแล้ว`;

  const html = renderEmailLayout({
    heading: 'E-Book ของคุณพร้อมแล้ว',
    greeting,
    introText,
    orderInfo,
    bookItems,
    primaryCta,
    fallbackUrlText,
    noticeText,
    isDemo: true
  });

  const text = renderEmailText({
    heading: 'E-Book ของคุณพร้อมแล้ว',
    greeting: greetingText,
    introText,
    orderInfo,
    bookItems,
    primaryCta,
    fallbackUrlText,
    noticeText,
    isDemo: true
  });

  return {
    subject: `SAFEMODE SHOP | E-Book ของคุณพร้อมแล้ว #${order.id}`,
    html,
    text
  };
}

/**
 * 2. Order Confirmation Email
 */
export function renderOrderConfirmationEmail(order, books, origin) {
  const items = Array.isArray(books) ? books : [books];
  const greeting = formatGreeting(order.customer_name);
  const greetingText = formatGreetingText(order.customer_name);

  const total = order.price != null
    ? Number(order.price)
    : items.reduce((sum, b) => sum + (Number(b.price) || 0), 0);

  const orderInfo = [
    { label: 'หมายเลขคำสั่งซื้อ', value: `#${order.id}` },
    { label: 'ยอดรวม', value: `${total} บาท` },
    { label: 'สถานะ', value: 'รอการชำระเงิน' }
  ];

  const bookItems = items.map(book => ({
    title: book.title,
    price: book.price
  }));

  const orderUrl = `${origin}/#order/${order.id}`;
  const primaryCta = { text: 'ตรวจสอบคำสั่งซื้อ', url: orderUrl };
  const introText = 'เราได้รับคำสั่งซื้อของคุณเรียบร้อยแล้ว คุณสามารถตรวจสอบรายการและดำเนินการชำระเงินจำลองได้จากลิงก์ด้านล่าง';

  const html = renderEmailLayout({
    heading: 'ยืนยันคำสั่งซื้อ',
    greeting,
    introText,
    orderInfo,
    bookItems,
    primaryCta,
    fallbackUrlText: orderUrl,
    noticeText: 'เมื่อบันทึกการชำระเงินจำลองเรียบร้อยแล้ว ระบบจะส่งลิงก์สำหรับเข้าถึง E-Book ให้คุณทันที',
    isDemo: true
  });

  const text = renderEmailText({
    heading: 'ยืนยันคำสั่งซื้อ',
    greeting: greetingText,
    introText,
    orderInfo,
    bookItems,
    primaryCta,
    fallbackUrlText: orderUrl,
    noticeText: 'เมื่อบันทึกการชำระเงินจำลองเรียบร้อยแล้ว ระบบจะส่งลิงก์สำหรับเข้าถึง E-Book ให้คุณทันที',
    isDemo: true
  });

  return {
    subject: `SAFEMODE SHOP | ยืนยันคำสั่งซื้อ #${order.id}`,
    html,
    text
  };
}

/**
 * 3. Password Reset Email
 */
export function renderPasswordResetEmail({ resetUrl, email, customerName, origin = 'https://safemode-shop.vercel.app' }) {
  const greeting = formatGreeting(customerName);
  const greetingText = formatGreetingText(customerName);

  const introText = `เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี SAFEMODE SHOP ของคุณ (${escapeHtml(email)}) กรุณากดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่`;
  const introTextPlain = `เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี SAFEMODE SHOP ของคุณ (${email}) กรุณากดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่`;

  const primaryCta = { text: 'ตั้งรหัสผ่านใหม่', url: resetUrl };
  const noticeText = 'หากคุณไม่ได้เป็นผู้ขอรีเซ็ตรหัสผ่าน คุณสามารถละเว้นอีเมลฉบับนี้ได้อย่างปลอดภัย บัญชีของคุณจะไม่ถูกเปลี่ยนแปลง เพื่อความปลอดภัย กรุณาอย่าส่งต่อลิงก์นี้ให้ผู้อื่น';

  const html = renderEmailLayout({
    heading: 'รีเซ็ตรหัสผ่านของคุณ',
    greeting,
    introText,
    primaryCta,
    fallbackUrlText: resetUrl,
    noticeText,
    isDemo: false
  });

  const text = renderEmailText({
    heading: 'รีเซ็ตรหัสผ่านของคุณ',
    greeting: greetingText,
    introText: introTextPlain,
    primaryCta,
    fallbackUrlText: resetUrl,
    noticeText,
    isDemo: false
  });

  return {
    subject: 'SAFEMODE SHOP | รีเซ็ตรหัสผ่านของคุณ',
    html,
    text
  };
}

/**
 * 4. Order Cancelled Email
 */
export function renderOrderCancelledEmail(order, origin) {
  const greeting = formatGreeting(order.customer_name);
  const greetingText = formatGreetingText(order.customer_name);

  const orderInfo = [
    { label: 'หมายเลขคำสั่งซื้อ', value: `#${order.id}` },
    { label: 'สถานะ', value: 'ยกเลิกแล้ว' }
  ];

  const catalogUrl = `${origin}/#catalog`;
  const primaryCta = { text: 'เลือกดู E-Book อื่นๆ', url: catalogUrl };
  const introText = 'คำสั่งซื้อของคุณถูกยกเลิกเรียบร้อยแล้ว หากคุณต้องการเลือกซื้อ E-Book เล่มอื่น สามารถกลับไปที่ร้านค้าได้ตลอดเวลา';

  const html = renderEmailLayout({
    heading: 'คำสั่งซื้อถูกยกเลิก',
    greeting,
    introText,
    orderInfo,
    primaryCta,
    fallbackUrlText: catalogUrl,
    isDemo: true
  });

  const text = renderEmailText({
    heading: 'คำสั่งซื้อถูกยกเลิก',
    greeting: greetingText,
    introText,
    orderInfo,
    primaryCta,
    fallbackUrlText: catalogUrl,
    isDemo: true
  });

  return {
    subject: `SAFEMODE SHOP | คำสั่งซื้อ #${order.id} ถูกยกเลิก`,
    html,
    text
  };
}

/**
 * 5. Welcome / Register Email
 */
export function renderWelcomeEmail({ customerName, origin = 'https://safemode-shop.vercel.app' }) {
  const greeting = formatGreeting(customerName);
  const greetingText = formatGreetingText(customerName);

  const catalogUrl = `${origin}/#catalog`;
  const primaryCta = { text: 'เลือกดู E-Book', url: catalogUrl };
  const introText = 'ยินดีต้อนรับสู่ SAFEMODE SHOP บัญชีของคุณพร้อมใช้งานแล้ว คุณสามารถเลือกดู E-Book คุณภาพ ติดตามคำสั่งซื้อ และเข้าถึงไฟล์ E-Book ที่ซื้อไว้ได้ตลอดเวลา';

  const html = renderEmailLayout({
    heading: 'ยินดีต้อนรับสู่ SAFEMODE SHOP',
    greeting,
    introText,
    primaryCta,
    fallbackUrlText: catalogUrl,
    isDemo: true
  });

  const text = renderEmailText({
    heading: 'ยินดีต้อนรับสู่ SAFEMODE SHOP',
    greeting: greetingText,
    introText,
    primaryCta,
    fallbackUrlText: catalogUrl,
    isDemo: true
  });

  return {
    subject: 'ยินดีต้อนรับสู่ SAFEMODE SHOP',
    html,
    text
  };
}

/**
 * 6. Email Verification
 */
export function renderVerificationEmail({ verifyUrl, email, customerName, origin = 'https://safemode-shop.vercel.app' }) {
  const greeting = formatGreeting(customerName);
  const greetingText = formatGreetingText(customerName);

  const introText = `กรุณายืนยันที่อยู่อีเมลของคุณ (${escapeHtml(email)}) เพื่อเริ่มต้นใช้งานบัญชี SAFEMODE SHOP อย่างสมบูรณ์`;
  const introTextPlain = `กรุณายืนยันที่อยู่อีเมลของคุณ (${email}) เพื่อเริ่มต้นใช้งานบัญชี SAFEMODE SHOP อย่างสมบูรณ์`;

  const primaryCta = { text: 'ยืนยันอีเมล', url: verifyUrl };
  const noticeText = 'หากคุณไม่ได้เป็นผู้สร้างบัญชีนี้ คุณสามารถละเว้นอีเมลฉบับนี้ได้อย่างปลอดภัย';

  const html = renderEmailLayout({
    heading: 'ยืนยันอีเมลของคุณ',
    greeting,
    introText,
    primaryCta,
    fallbackUrlText: verifyUrl,
    noticeText,
    isDemo: false
  });

  const text = renderEmailText({
    heading: 'ยืนยันอีเมลของคุณ',
    greeting: greetingText,
    introText: introTextPlain,
    primaryCta,
    fallbackUrlText: verifyUrl,
    noticeText,
    isDemo: false
  });

  return {
    subject: 'SAFEMODE SHOP | ยืนยันอีเมลของคุณ',
    html,
    text
  };
}

/**
 * 7. Admin Notification Email
 */
export function renderAdminNotificationEmail({ title = 'การแจ้งเตือนจากระบบ', message = '', order = null, origin = 'https://safemode-shop.vercel.app' }) {
  const orderInfo = order ? [
    { label: 'หมายเลขคำสั่งซื้อ', value: `#${order.id}` },
    { label: 'ลูกค้า', value: order.customer_name || '-' },
    { label: 'อีเมล', value: order.email || '-' },
    { label: 'สถานะ', value: order.status || '-' }
  ] : null;

  const adminUrl = `${origin}/admin`;
  const primaryCta = { text: 'เปิด Admin Panel', url: adminUrl };

  const html = renderEmailLayout({
    heading: `Admin | ${escapeHtml(title)}`,
    introText: escapeHtml(message),
    orderInfo,
    primaryCta,
    fallbackUrlText: adminUrl,
    isDemo: true
  });

  const text = renderEmailText({
    heading: `Admin | ${title}`,
    introText: message,
    orderInfo,
    primaryCta,
    fallbackUrlText: adminUrl,
    isDemo: true
  });

  return {
    subject: `SAFEMODE SHOP Admin | ${title}`,
    html,
    text
  };
}
