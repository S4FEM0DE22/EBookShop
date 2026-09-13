-- Run in Supabase SQL Editor before deploying.
-- Both tables are accessed only by server-side API functions with the secret key.

create table if not exists public.books (
  id text primary key,
  title text not null,
  subtitle text not null,
  description text not null,
  price integer not null check (price > 0),
  author text not null,
  cover text not null,
  file text not null,
  active boolean not null default true
);

create table if not exists public.orders (
  id text primary key,
  book_id text not null references public.books(id),
  book_ids text[],
  customer_name text not null,
  email text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID')),
  email_status text not null default 'NOT_SENT' check (email_status in ('NOT_SENT', 'DEMO', 'SENT', 'FAILED', 'NOT_CONFIGURED')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists orders_email_idx on public.orders(email);
alter table public.orders add column if not exists book_ids text[];
alter table public.books add column if not exists active boolean not null default true;

alter table public.books enable row level security;
alter table public.orders enable row level security;

-- No anon/authenticated policies: browsers cannot read private order details.
revoke all on public.books from anon, authenticated;
revoke all on public.orders from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('ebooks', 'ebooks', false)
on conflict (id) do update set public = false;

-- Keep historical demo orders readable while removing sample books from the storefront.
update public.books set active = false where id in ('vibe-coding', 'web-design', 'launch-guide');

-- Prices are provisional until the shop owner confirms them.
insert into public.books (id, title, subtitle, description, price, author, cover, file, active)
values
('media-player-pro', 'รายงานการพัฒนา Media Player PRO', 'ใบงานที่ 1 · โปรแกรมเล่นเพลง', 'รายงาน 10 หน้าเกี่ยวกับการออกแบบและพัฒนาโปรแกรมเล่นเพลงด้วย Python และ PyQt6 พร้อม Playlist, Waveform, Equalizer และผลทดสอบ', 129, 'นพนันท์ ศุภมาตร์', '/assets/covers/media-player-pro.jpg', 'media-player-pro.pdf', true),
('tarot-app', 'รายงานการพัฒนา Tarot App', 'ใบงานที่ 2 · แอปไพ่ทาโรต์', 'รายงาน 14 หน้าเกี่ยวกับหน้าจอ แผนพัฒนา และการทดสอบแอปไพ่ทาโรต์ด้วย Python และ PyQt6 รวมโหมดอดีต ปัจจุบัน อนาคต', 149, 'นพนันท์ ศุภมาตร์', '/assets/covers/tarot-app.jpg', 'tarot-app.pdf', true),
('sqlite-task-manager-guide', 'คู่มือใช้งาน SQLite Task Manager PRO', 'คู่มือ · ติดตั้งและเริ่มใช้งาน', 'คู่มือ PDF 5 หน้า ครอบคลุมการติดตั้ง เปิดโปรแกรม เริ่มจัดการงาน และนำเข้าข้อมูลตัวอย่างด้วย CSV', 99, 'นพนันท์ ศุภมาตร์', '/assets/covers/sqlite-task-manager-guide.jpg', 'sqlite-task-manager-guide.pdf', true),
('sqlite-task-manager-report', 'รายงานการพัฒนา SQLite Task Manager PRO', 'ใบงานที่ 3 · โปรแกรมจัดการงาน', 'รายงาน 8 หน้าเกี่ยวกับแนวคิดและผลการพัฒนาโปรแกรมจัดการงานด้วย Python, PyQt6 และ SQLite พร้อมสรุปผลทดสอบ', 149, 'นพนันท์ ศุภมาตร์', '/assets/covers/sqlite-task-manager-report.jpg', 'sqlite-task-manager-report.pdf', true)
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  price = excluded.price,
  author = excluded.author,
  cover = excluded.cover,
  file = excluded.file,
  active = excluded.active;
