export const books = [
  {
    id: 'vibe-coding',
    title: 'เริ่มต้น Vibe Coding',
    subtitle: 'จากไอเดียสู่เว็บแรก',
    description: 'ฝึกสั่ง AI อย่างมีเป้าหมาย วางแผนหน้าจอ และตรวจโค้ดทีละขั้น',
    price: 129,
    author: 'Demo E-book Studio',
    cover: 'cover-vibe',
    file: 'vibe-coding.pdf'
  },
  {
    id: 'web-design',
    title: 'ออกแบบเว็บให้อ่านง่าย',
    subtitle: 'UI ที่เริ่มจากคนใช้',
    description: 'หลักการจัดลำดับข้อมูล สี ตัวอักษร และการออกแบบสำหรับมือถือ',
    price: 149,
    author: 'Demo E-book Studio',
    cover: 'cover-design',
    file: 'web-design.pdf'
  },
  {
    id: 'launch-guide',
    title: 'ปล่อยเว็บอย่างมั่นใจ',
    subtitle: 'เช็กลิสต์ก่อนขึ้นระบบ',
    description: 'รู้จักการตั้งค่า environment, ทดสอบ flow และตรวจความปลอดภัยพื้นฐาน',
    price: 169,
    author: 'Demo E-book Studio',
    cover: 'cover-launch',
    file: 'launch-guide.pdf'
  }
];

export function findBook(id) {
  return books.find(book => book.id === id);
}
