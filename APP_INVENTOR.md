# Android WebViewer ด้วย MIT App Inventor

ต้องมี Vercel Production URL ที่เปิดใช้งานได้ก่อนทำแอป เพราะ `localhost` ใช้บนมือถือไม่ได้

1. เข้า MIT App Inventor สร้างโปรเจกต์ใหม่ชื่อ `SafeModeShopDemo`
2. ที่ `Screen1`: ตั้ง `Title = SAFE MODE SHOP`, `Sizing = Responsive`, `Scrollable = false`
3. ลาก `WebViewer` หนึ่งตัวชื่อ `WebViewer1` วางบน `Screen1`; ตั้ง `Width = Fill parent`, `Height = Fill parent`, `HomeUrl = <Vercel Production URL>`, `FollowLinks = true`, `IgnoreSslErrors = false`, `UsesLocation = false`
4. ใน Blocks ให้ใช้เหตุการณ์ `when Screen1.BackPressed`: ถ้า `WebViewer1.CanGoBack` เป็นจริง ให้เรียก `WebViewer1.GoBack`; มิฉะนั้นให้ปิดแอป
5. ทดสอบด้วย AI Companion หรือมือถือจริง: เปิดร้าน เลือกเล่ม ไป Checkout และกดย้อนกลับ ควรย้อนในเว็บไซต์ก่อนออกจากแอป
6. เลือก `Build → Android App (.apk)` และส่งออกไฟล์ `.aia` เก็บไว้แก้ไขภายหลัง

การดาวน์โหลดไฟล์ใน WebViewer อาจไม่เสถียร ผู้ใช้ควรเปิดลิงก์ที่ได้รับทางอีเมลในเบราว์เซอร์หรือแอปอีเมลปกติ ห้ามตั้ง `IgnoreSslErrors = true`
