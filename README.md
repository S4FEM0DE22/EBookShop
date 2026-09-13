# Chapter & Co. — E-book Shop Demo

เว็บร้าน E-book สาธิตตามใบงาน Vibe Coding 2026 มีหนังสือตัวอย่าง 3 เล่ม, Checkout, คำสั่งซื้อ `PENDING`, ปุ่ม Mock Payment เปลี่ยนเป็น `PAID`, การติดตามด้วยเลขคำสั่งซื้อและอีเมล, และลิงก์ดาวน์โหลดชั่วคราว ไม่มีการรับเงินจริง

## ทดสอบในเครื่อง

ต้องมี Node.js 20 ขึ้นไป ไม่ต้องติดตั้งแพ็กเกจเพิ่ม

```powershell
npm run dev
```

เปิด `http://localhost:3000` แล้วลองครบ flow ได้ทันที ระบบจะเก็บคำสั่งซื้อใน `.data/orders.json` และแสดงลิงก์ดาวน์โหลดแทนการส่งอีเมลจริง โหมดนี้ใช้ทดสอบบนเครื่องเท่านั้น

```powershell
npm test
```

## ตั้งค่า Supabase และอีเมล

1. สร้าง Supabase project แล้วรัน [schema.sql](supabase/schema.sql) ใน SQL Editor จะได้ตาราง `books`, `orders` ที่เปิด RLS และ private Storage bucket ชื่อ `ebooks`
2. อัปโหลด PDF ทั้ง 3 ไฟล์จาก `private-books/` ไปยัง bucket `ebooks` โดยคงชื่อไฟล์เดิม และตรวจว่า bucket **ไม่เป็น public**
3. สร้าง Resend API key และยืนยันโดเมนผู้ส่ง แล้วใช้ที่อยู่นั้นใน `EMAIL_FROM` ถ้าใช้โดเมนทดสอบของ Resend อาจส่งได้เฉพาะอีเมลบัญชีผู้สร้าง
4. ตั้งค่า Environment Variables ใน Vercel ตาม [.env.example](.env.example): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `DOWNLOAD_SECRET`, `PUBLIC_SITE_URL` ห้ามนำ secret ใส่หน้าเว็บหรือ GitHub
5. เชื่อม repository กับ Vercel แล้ว deploy โดยใช้ root directory ของโปรเจกต์นี้ ไม่ต้องมี build command จากนั้นเปิด Production URL เพื่อทดสอบครบ flow

`SUPABASE_SECRET_KEY` เป็น secret key รูปแบบใหม่ (`sb_secret_...`) หรือ service_role key แบบเดิม ใช้เฉพาะ server function เท่านั้น `DOWNLOAD_SECRET` ต้องเป็นสตริงสุ่มอย่างน้อย 32 ตัวอักษร เมื่อเปลี่ยนค่าตัวแปรให้ redeploy

## วิธีทำงานของลิงก์ดาวน์โหลด

หลัง `PAID` ระบบส่งอีเมลด้วย Resend พร้อมลิงก์ 24 ชั่วโมง เมื่อเปิดลิงก์ API จะตรวจสถานะอีกครั้งและออก Supabase Storage signed URL อายุ 5 นาที ไฟล์อยู่ใน private bucket วิธีนี้จำกัดการเข้าถึง แต่ไม่ใช่ DRM และผู้รับยังสามารถส่งต่อไฟล์ได้

## สิ่งที่ต้องทำก่อนส่งงาน

ดู [รายงานและเช็กลิสต์](REPORT.md) สำหรับหลักฐานที่ตรวจแล้วและรายการที่ต้องทำด้วยบัญชีภายนอก ดู [คู่มือ App Inventor](APP_INVENTOR.md) สำหรับ Android WebViewer wrapper

โครงการนี้เป็นงานสาธิต ห้ามใช้รับเงินจริงหรือเก็บข้อมูลบัตร
