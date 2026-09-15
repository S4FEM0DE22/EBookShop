export const books = [
  {
    id: 'media-player-pro',
    title: 'รายงานการพัฒนา Media Player PRO',
    subtitle: 'ใบงานที่ 1 · โปรแกรมเล่นเพลง',
    description: 'รายงานการพัฒนาโปรแกรมเล่นเพลงด้วย Python และ PyQt6 พร้อมฟังก์ชัน Playlist, Waveform และ Equalizer เหมาะสำหรับศึกษาการสร้างแอปพลิเคชัน Multimedia',
    price: 129,
    author: 'นพนันท์ ศุภมาตร์',
    cover: '/assets/covers/media-player-pro.jpg',
    file: 'media-player-pro.pdf'
  },
  {
    id: 'tarot-app',
    title: 'รายงานการพัฒนา Tarot App',
    subtitle: 'ใบงานที่ 2 · แอปไพ่ทาโรต์',
    description: 'รายงานอธิบายสถาปัตยกรรมและผลการพัฒนาแอปไพ่ทาโรต์ด้วย Python และ PyQt6 ครอบคลุมโหมดทำนายอดีต ปัจจุบัน อนาคต และการทดสอบระบบ',
    price: 149,
    author: 'นพนันท์ ศุภมาตร์',
    cover: '/assets/covers/tarot-app.jpg',
    file: 'tarot-app.pdf'
  },
  {
    id: 'sqlite-task-manager-guide',
    title: 'คู่มือใช้งาน SQLite Task Manager PRO',
    subtitle: 'คู่มือ · ติดตั้งและเริ่มใช้งาน',
    description: 'คู่มือ PDF ฉบับเร่งรัด อธิบายขั้นตอนติดตั้ง การเปิดโปรแกรม การจัดหมวดหมู่งาน และวิธีนำเข้าข้อมูลตัวอย่างจาก CSV ให้พร้อมใช้งานทันที',
    price: 99,
    author: 'นพนันท์ ศุภมาตร์',
    cover: '/assets/covers/sqlite-task-manager-guide.jpg',
    file: 'sqlite-task-manager-guide.pdf'
  },
  {
    id: 'sqlite-task-manager-report',
    title: 'รายงานการพัฒนา SQLite Task Manager PRO',
    subtitle: 'ใบงานที่ 3 · โปรแกรมจัดการงาน',
    description: 'รายงานวิเคราะห์แนวคิด โครงสร้างฐานข้อมูล และผลการพัฒนาโปรแกรมจัดการงานด้วย Python, PyQt6 และ SQLite พร้อมเอกสารสรุปผลทดสอบ',
    price: 149,
    author: 'นพนันท์ ศุภมาตร์',
    cover: '/assets/covers/sqlite-task-manager-report.jpg',
    file: 'sqlite-task-manager-report.pdf'
  }
];

export function findBook(id) {
  return books.find(book => book.id === id);
}
