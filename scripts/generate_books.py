from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'private-books'
OUT.mkdir(exist_ok=True)
pdfmetrics.registerFont(TTFont('Tahoma', r'C:\Windows\Fonts\tahoma.ttf'))
pdfmetrics.registerFont(TTFont('Tahoma-Bold', r'C:\Windows\Fonts\tahomabd.ttf'))

BOOKS = [
    ('vibe-coding.pdf', 'เริ่มต้น Vibe Coding', 'จากไอเดียสู่เว็บแรก', '#b44c52', [
        ('01  เริ่มจากเป้าหมาย', [
            'เขียนให้ชัดว่าผู้ใช้คือใคร และเขาต้องทำอะไรได้',
            'กำหนดหน้าจอหลัก ข้อมูลที่ใช้ และสิ่งที่ยังไม่ทำ',
            'ขอให้ AI สรุปโครงสร้างก่อนเริ่มเขียนโค้ด',
            'แบ่งงานเป็นรอบสั้น ๆ ที่เปิดทดสอบได้ทันที',
        ]),
        ('02  ตรวจผลทุกครั้ง', [
            'หลังแก้หนึ่งส่วน ให้เปิดเว็บและลองใช้งานจริง',
            'ทดสอบทั้งกรณีสำเร็จและกรณีกรอกข้อมูลผิด',
            'ถามว่าไฟล์ใดเปลี่ยน และมีค่าที่ต้องตั้งเองหรือไม่',
            'อย่าใส่ API key หรือรหัสผ่านในข้อความที่ส่งให้ AI',
        ])
    ]),
    ('web-design.pdf', 'ออกแบบเว็บให้อ่านง่าย', 'UI ที่เริ่มจากคนใช้', '#236776', [
        ('01  จัดลำดับข้อมูล', [
            'ให้สิ่งที่ผู้ใช้ต้องทำอยู่ในหน้าจอแรก',
            'ใช้หัวข้อสั้นและชัดเจน แยกเนื้อหาเป็นกลุ่ม',
            'ปุ่มหลักควรเด่น และมีข้อความบอกผลหลังการกด',
            'ลดรายละเอียดที่ไม่ช่วยให้ตัดสินใจ',
        ]),
        ('02  ออกแบบสำหรับมือถือ', [
            'ตัวอักษรหลักควรอ่านได้โดยไม่ต้องขยาย',
            'ปุ่มและช่องกรอกต้องแตะได้สะดวก',
            'ตรวจว่าหน้าไม่เลื่อนแนวนอนและข้อความไม่ถูกตัด',
            'ลองใช้ด้วยคีย์บอร์ดและตรวจคำอธิบายรูปภาพ',
        ])
    ]),
    ('launch-guide.pdf', 'ปล่อยเว็บอย่างมั่นใจ', 'เช็กลิสต์ก่อนขึ้นระบบ', '#60519a', [
        ('01  ก่อนเผยแพร่', [
            'รันระบบในเครื่องและทดสอบเส้นทางหลักให้ครบ',
            'เก็บ secret ใน Environment Variables ฝั่ง server',
            'ตรวจว่าไฟล์ .env ไม่ถูกส่งขึ้น repository',
            'ตรวจสิทธิ์ฐานข้อมูลและการเข้าถึงไฟล์ส่วนตัว',
        ]),
        ('02  หลังเผยแพร่', [
            'เปิด production URL ทั้งบนคอมพิวเตอร์และมือถือ',
            'ทดสอบการสร้างคำสั่งซื้อและการส่งอีเมลจริง',
            'ถ้าเปลี่ยน Environment Variables ให้ redeploy',
            'บันทึกปัญหาและแก้ทีละจุดก่อนส่งงาน',
        ])
    ])
]

W, H = 595, 842
for filename, title, subtitle, color, sections in BOOKS:
    pdf = canvas.Canvas(str(OUT / filename), pagesize=(W, H), pageCompression=1)
    pdf.setTitle(title)
    pdf.setAuthor('Demo E-book Studio')
    pdf.setFillColor(color)
    pdf.rect(0, 0, W, H, fill=1, stroke=0)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont('Tahoma', 12)
    pdf.drawString(58, H - 75, 'CHAPTER & CO.  /  E-BOOK SAMPLE')
    pdf.setFont('Tahoma-Bold', 31)
    pdf.drawString(58, H - 260, title)
    pdf.setFont('Tahoma', 17)
    pdf.drawString(58, H - 302, subtitle)
    pdf.setStrokeColorRGB(.96, .79, .38)
    pdf.setLineWidth(4)
    pdf.line(58, H - 336, 170, H - 336)
    pdf.setFont('Tahoma', 12)
    pdf.drawString(58, 72, 'DEMO ONLY  |  หนังสือตัวอย่างสำหรับใบงาน')
    pdf.showPage()
    for index, (heading, lines) in enumerate(sections, start=2):
        pdf.setFillColor(color)
        pdf.rect(0, H - 16, W, 16, fill=1, stroke=0)
        pdf.setFillColorRGB(.11, .16, .24)
        pdf.setFont('Tahoma-Bold', 22)
        pdf.drawString(58, H - 105, heading)
        pdf.setStrokeColorRGB(.85, .89, .92)
        pdf.setLineWidth(1)
        pdf.line(58, H - 124, W - 58, H - 124)
        y = H - 176
        for line in lines:
            pdf.setFillColor(color)
            pdf.circle(68, y + 4, 4, fill=1, stroke=0)
            pdf.setFillColorRGB(.14, .21, .29)
            pdf.setFont('Tahoma', 14)
            pdf.drawString(86, y, line)
            y -= 67
        pdf.setFont('Tahoma', 10)
        pdf.setFillColorRGB(.48, .53, .58)
        pdf.drawString(58, 55, 'Chapter & Co.  |  E-book Shop Demo')
        pdf.drawRightString(W - 58, 55, str(index))
        pdf.showPage()
    pdf.save()
    print(OUT / filename)
