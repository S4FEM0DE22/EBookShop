# รายงานตรวจงาน — SAFE MODE SHOP E-book Shop Demo

วันที่ตรวจ: 14 กันยายน 2026

## สิ่งที่ทำแล้วและทดสอบได้ในเครื่อง

| รายการ | ผลตรวจ |
| --- | --- |
| ปรับหน้าแรก สินค้า ตะกร้า ชำระเงิน คำสั่งซื้อ และโปรไฟล์ตามภาพต้นแบบ | ทำแล้ว; เปิดตรวจภาพหน้าเดสก์ท็อปและมือถือ |
| PDF จริง 4 ไฟล์ พร้อมปก ชื่อ คำอธิบาย ราคา | ทำแล้ว; คัดลอกจากไฟล์ที่ผู้ใช้ให้มาและตรวจ SHA-256 ตรงต้นฉบับ ราคาใช้ในระบบ mock |
| ตะกร้าหลายเล่มและยอดรวม | ผ่านการทดสอบทั้ง 4 เล่ม; ทดลองในเบราว์เซอร์ 2 เล่ม ยอดจำลอง 278 บาท |
| Checkout สร้างเลขคำสั่งซื้อและ PENDING | ผ่านการทดสอบ |
| ป้าย DEMO ONLY และปุ่มเปลี่ยนเป็น PAID | ผ่านการทดสอบ |
| หน้าติดตามแบบรายการตามภาพต้นแบบ | ผ่านการทดสอบบนเดสก์ท็อปและมือถือ; แสดง PENDING, PAID, CANCELLED พร้อมปุ่มตามสถานะ |
| ยกเลิกคำสั่งซื้อที่ยัง PENDING | ผ่านการทดสอบ; ยกเลิกแล้วชำระหรือดาวน์โหลดไม่ได้ |
| ติดตามด้วยเลขคำสั่งซื้อและอีเมลใน Modal | ปุ่มค้นหาอยู่ด้านขวาแถวเดียวกับหัวข้อรายการ; ผ่านการทดสอบบนเดสก์ท็อปและมือถือ, ปิดด้วยปุ่มหรือ Esc ได้, อีเมลไม่ตรงแสดงข้อผิดพลาดใน Modal, ลิงก์เลขคำสั่งซื้อเปิด Modal พร้อมกรอกเลขให้ |
| ลิงก์ดาวน์โหลดแยกเล่มหลัง PAID | ผ่านในเครื่อง; PDF จริงทั้ง 4 ไฟล์เปิดได้ และ token ของเล่มที่ไม่อยู่ในคำสั่งซื้อได้ 403 |
| Supabase และ PDF ใน private bucket | อัปโหลด PDF ทั้ง 4 เล่มใน `ebooks`; ตรวจลิงก์ชั่วคราวและ SHA-256 ตรงไฟล์ต้นฉบับทุกเล่ม; ทดสอบคำสั่งซื้อ mock จนเป็น PAID และดาวน์โหลดผ่านเว็บได้ทั้ง 4 เล่ม |
| ทดสอบอีเมล | โหมดในเครื่องแสดงผล `DEMO`; การทดสอบผ่าน Supabase แสดง `NOT_CONFIGURED` และมีลิงก์ดาวน์โหลดบนหน้าเว็บ ยังไม่ได้ส่งอีเมลจริง |

ภาพหลักฐานที่บันทึกจากการทดสอบ **ในเครื่อง**:

- [หน้าร้านบนคอมพิวเตอร์](output/screenshots/desktop-store.png)
- [หน้าแรกบนมือถือ](output/screenshots/mobile-home.png)
- [หน้าร้านบนมือถือ](output/screenshots/mobile-store.png)
- [หน้าติดตามแบบรายการบนคอมพิวเตอร์](output/screenshots/desktop-tracking.png)
- [หน้าติดตามแบบรายการบนมือถือ](output/screenshots/mobile-tracking.png)
- [ปุ่มค้นหาด้านขวาของหัวข้อบนคอมพิวเตอร์](output/screenshots/desktop-tracking-header.png)
- [ปุ่มค้นหาด้านขวาของหัวข้อบนมือถือ](output/screenshots/mobile-tracking-header.png)
- [Modal ค้นหาคำสั่งซื้อบนคอมพิวเตอร์](output/screenshots/desktop-tracking-modal.png)
- [Modal ค้นหาคำสั่งซื้อบนมือถือ](output/screenshots/mobile-tracking-modal.png)
- [ประวัติคำสั่งซื้อบนคอมพิวเตอร์](output/screenshots/desktop-history.png)
- [ตะกร้าบนมือถือ](output/screenshots/mobile-cart.png)
- [Checkout บนมือถือ](output/screenshots/mobile-checkout.png)
- [สถานะ PENDING บนมือถือ](output/screenshots/mobile-pending.png)
- [สถานะ PAID และลิงก์ดาวน์โหลดบนมือถือ](output/screenshots/mobile-paid.png)
- [สถานะ PAID บนคอมพิวเตอร์](output/screenshots/desktop-paid.png)

## สถานะบริการจริงและงานที่เหลือ

| รายการ | สถานะ / หลักฐานที่ต้องแนบ |
| --- | --- |
| Resend ส่งอีเมลจริง | ยังไม่มี API key และโดเมนผู้ส่ง; แนบภาพอีเมลที่ได้รับหลัง PAID |
| GitHub repository ไม่มี secret | ส่งโค้ดขึ้น [EBookShop](https://github.com/S4FEM0DE22/EBookShop) บน branch `main` แล้ว; ตรวจประวัติ Git ไม่พบ secret จริงหรือ PDF ส่วนตัว และ `.env.local` ถูกละเว้นจาก Git |
| Vercel Production URL | เผยแพร่แล้วที่ https://safemode-shop.vercel.app/; ทดสอบหน้าเว็บและหนังสือ 4 เล่มจาก Supabase, สร้างคำสั่งซื้อ `PENDING`, เปลี่ยนเป็น `PAID`, ค้นหาด้วยเลขคำสั่งซื้อและอีเมลใน Modal ได้; Runtime Logs แสดง `/api/orders` 201, `/api/pay` 200, `/api/order` 200 และ `/api/download` 302 ไปยังลิงก์ไฟล์ส่วนตัว |
| Android WebViewer และปุ่มย้อนกลับ | ยังไม่ได้ทดสอบบนมือถือ; ทำตาม `APP_INVENTOR.md` |
| ไฟล์ APK และ AIA | ยังไม่ได้ build; แนบไฟล์หลังทดสอบแอป |

## ข้อจำกัด

การชำระเงินเป็น Mock Payment เท่านั้น ไม่มี Payment Gateway, QR จริง, OTP จริง หรือข้อมูลบัตร โปรไฟล์และประวัติบนหน้าเว็บจำได้เฉพาะ session ไม่ใช่บัญชีผู้ใช้ ลิงก์ชั่วคราวช่วยจำกัดเวลาเข้าถึง แต่ไม่ป้องกันการส่งต่อ PDF ระบบและ Android wrapper นี้เป็นต้นแบบสำหรับการเรียน ไม่ควรนำไปขายจริงโดยไม่มีการตรวจความปลอดภัยและทดสอบเพิ่มเติม
