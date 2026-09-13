# SAFE MODE SHOP — E-book Shop Demo

เว็บร้าน E-book สาธิตตามใบงาน Vibe Coding 2026 ปรับหน้าตาตามภาพต้นแบบ SAFE MODE SHOP: โทนขาวดำ, เมนูทรงแคปซูล, หน้าแรกแบบสไลด์, แค็ตตาล็อก, ตะกร้า, ติดตามคำสั่งซื้อ และโปรไฟล์ในเบราว์เซอร์ แค็ตตาล็อกใช้ PDF ที่ผู้ใช้ให้มา 4 ไฟล์แทนหนังสือตัวอย่างเดิม เลือกซื้อพร้อมกันได้สูงสุด 4 เล่ม แล้ว Checkout เป็นคำสั่งซื้อ `PENDING` หน้าติดตามแสดงรายการเป็นแถวพร้อมปุ่มชำระหรือยกเลิก เปลี่ยนสถานะเป็น `PAID` หรือ `CANCELLED` และแสดงลิงก์ดาวน์โหลดของแต่ละเล่มหลัง PAID ไม่มีการรับเงินจริง

## หนังสือที่แสดงในร้าน

| ไฟล์ใน private-books | รายการ | หน้า | ราคาจำลอง |
| --- | --- | ---: | ---: |
| `media-player-pro.pdf` | รายงานการพัฒนา Media Player PRO | 10 | 129 บาท |
| `tarot-app.pdf` | รายงานการพัฒนา Tarot App | 14 | 149 บาท |
| `sqlite-task-manager-guide.pdf` | คู่มือใช้งาน SQLite Task Manager PRO | 5 | 99 บาท |
| `sqlite-task-manager-report.pdf` | รายงานการพัฒนา SQLite Task Manager PRO | 8 | 149 บาท |

ราคาในตารางใช้คำนวณยอดรวมของระบบ mock เท่านั้น หากต้องการเปลี่ยนตัวเลข ให้แก้ให้ตรงกันทั้ง [catalog.js](lib/catalog.js) และ [schema.sql](supabase/schema.sql) ภาพปกอยู่ใน `public/assets/covers/` ซึ่งแสดงได้โดยไม่เปิด PDF เต็มเล่ม ส่วน PDF จริงอยู่ใน `private-books/` และถูกละเว้นจาก Git

## ทดสอบในเครื่อง

ต้องมี Node.js 20 ขึ้นไป ไม่ต้องติดตั้งแพ็กเกจเพิ่ม

```powershell
npm run dev
```

เปิด `http://localhost:3000` แล้วลองครบ flow ได้ทันที ระบบจะเก็บคำสั่งซื้อใน `.data/orders.json` และแสดงลิงก์ดาวน์โหลดแทนการส่งอีเมลจริง โหมดนี้ใช้ทดสอบบนเครื่องเท่านั้น ประวัติคำสั่งซื้อและข้อมูลโปรไฟล์ที่หน้าเว็บจำไว้เฉพาะ session ของเบราว์เซอร์ ไม่ใช่ระบบบัญชีผู้ใช้

หากต้องการทดสอบกับ Supabase ในเครื่อง ให้ใส่ `SUPABASE_URL`, `SUPABASE_SECRET_KEY` และ `DOWNLOAD_SECRET` ใน `.env.local` (ไฟล์นี้ถูกละเว้นจาก Git) แล้วรัน `npm run dev:supabase` แทน `npm run dev` โดยหยุดเซิร์ฟเวอร์เดิมก่อน ไฟล์ `.env.example` เป็นเพียงตัวอย่างและห้ามใส่ secret จริง

หน้าติดตามแสดงคำสั่งซื้อที่สร้างหรือค้นพบใน session นี้ตามภาพต้นแบบ พร้อมสถานะ ปุ่ม Mock Payment และปุ่มยกเลิกสำหรับรายการที่ยัง `PENDING` หากต้องการดูคำสั่งซื้อที่ไม่ได้อยู่ใน session ให้กดปุ่มค้นหาเพื่อเปิด Modal แล้วกรอกเลขคำสั่งซื้อกับอีเมล หน้าประวัติแสดงทั้งรายการที่ชำระแล้วและรายการที่ยกเลิก

```powershell
npm test
```

## ตั้งค่า Supabase และอีเมล

1. สร้าง Supabase project แล้วรัน [schema.sql](supabase/schema.sql) ใน SQL Editor จะได้ตาราง `books`, `orders` ที่เปิด RLS และ private Storage bucket ชื่อ `ebooks`
2. อัปโหลดเฉพาะ PDF ทั้ง 4 ไฟล์ในตารางข้างบนจาก `private-books/` ไปยัง bucket `ebooks` โดยคงชื่อไฟล์เดิม และตรวจว่า bucket **ไม่เป็น public**
3. สร้าง Resend API key และยืนยันโดเมนผู้ส่ง แล้วใช้ที่อยู่นั้นใน `EMAIL_FROM` ถ้าใช้โดเมนทดสอบของ Resend อาจส่งได้เฉพาะอีเมลบัญชีผู้สร้าง
4. ตั้งค่า Environment Variables ใน Vercel ตาม [.env.example](.env.example): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `DOWNLOAD_SECRET`, `PUBLIC_SITE_URL` ห้ามนำ secret ใส่หน้าเว็บหรือ GitHub
5. เชื่อม repository กับ Vercel แล้ว deploy โดยใช้ root directory ของโปรเจกต์นี้ ไม่ต้องมี build command จากนั้นเปิด Production URL เพื่อทดสอบครบ flow

`SUPABASE_SECRET_KEY` เป็น secret key รูปแบบใหม่ (`sb_secret_...`) หรือ service_role key แบบเดิม ใช้เฉพาะ server function เท่านั้น `DOWNLOAD_SECRET` ต้องเป็นสตริงสุ่มอย่างน้อย 32 ตัวอักษร เมื่อเปลี่ยนค่าตัวแปรให้ redeploy

## วิธีทำงานของลิงก์ดาวน์โหลด

หลัง `PAID` ระบบส่งอีเมลด้วย Resend พร้อมลิงก์แยกแต่ละเล่ม อายุ 24 ชั่วโมง เมื่อเปิดลิงก์ API จะตรวจสถานะและตรวจว่าเล่มนั้นอยู่ในคำสั่งซื้อ แล้วออก Supabase Storage signed URL อายุ 5 นาที ไฟล์อยู่ใน private bucket วิธีนี้จำกัดการเข้าถึง แต่ไม่ใช่ DRM และผู้รับยังสามารถส่งต่อไฟล์ได้

## สิ่งที่ต้องทำก่อนส่งงาน

ดู [รายงานและเช็กลิสต์](REPORT.md) สำหรับหลักฐานที่ตรวจแล้วและรายการที่ต้องทำด้วยบัญชีภายนอก ดู [คู่มือ App Inventor](APP_INVENTOR.md) สำหรับ Android WebViewer wrapper

โครงการนี้เป็นงานสาธิต ห้ามใช้รับเงินจริงหรือเก็บข้อมูลบัตร
