export const books = [
  {
    id: 'media-player-pro',
    title: 'รายงานการพัฒนา Media Player PRO',
    subtitle: 'ใบงานที่ 1 · โปรแกรมเล่นเพลง',
    description: 'รายงาน 10 หน้าเกี่ยวกับการออกแบบและพัฒนาโปรแกรมเล่นเพลงด้วย Python และ PyQt6 พร้อม Playlist, Waveform, Equalizer และผลทดสอบ',
    price: 129,
    author: 'นพนันท์ ศุภมาตร์',
    cover: '/assets/covers/media-player-pro.jpg',
    file: 'media-player-pro.pdf'
  },
  {
    id: 'tarot-app',
    title: 'รายงานการพัฒนา Tarot App',
    subtitle: 'ใบงานที่ 2 · แอปไพ่ทาโรต์',
    description: 'รายงาน 14 หน้าเกี่ยวกับหน้าจอ แผนพัฒนา และการทดสอบแอปไพ่ทาโรต์ด้วย Python และ PyQt6 รวมโหมดอดีต ปัจจุบัน อนาคต',
    price: 149,
    author: 'นพนันท์ ศุภมาตร์',
    cover: '/assets/covers/tarot-app.jpg',
    file: 'tarot-app.pdf'
  },
  {
    id: 'sqlite-task-manager-guide',
    title: 'คู่มือใช้งาน SQLite Task Manager PRO',
    subtitle: 'คู่มือ · ติดตั้งและเริ่มใช้งาน',
    description: 'คู่มือ PDF 5 หน้า ครอบคลุมการติดตั้ง เปิดโปรแกรม เริ่มจัดการงาน และนำเข้าข้อมูลตัวอย่างด้วย CSV',
    price: 99,
    author: 'นพนันท์ ศุภมาตร์',
    cover: '/assets/covers/sqlite-task-manager-guide.jpg',
    file: 'sqlite-task-manager-guide.pdf'
  },
  {
    id: 'sqlite-task-manager-report',
    title: 'รายงานการพัฒนา SQLite Task Manager PRO',
    subtitle: 'ใบงานที่ 3 · โปรแกรมจัดการงาน',
    description: 'รายงาน 8 หน้าเกี่ยวกับแนวคิดและผลการพัฒนาโปรแกรมจัดการงานด้วย Python, PyQt6 และ SQLite พร้อมสรุปผลทดสอบ',
    price: 149,
    author: 'นพนันท์ ศุภมาตร์',
    cover: '/assets/covers/sqlite-task-manager-report.jpg',
    file: 'sqlite-task-manager-report.pdf'
  }
];

export function findBook(id) {
  return books.find(book => book.id === id);
}
