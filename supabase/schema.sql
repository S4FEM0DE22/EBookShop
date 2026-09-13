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
  file text not null
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

alter table public.books enable row level security;
alter table public.orders enable row level security;

-- No anon/authenticated policies: browsers cannot read private order details.
revoke all on public.books from anon, authenticated;
revoke all on public.orders from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('ebooks', 'ebooks', false)
on conflict (id) do update set public = false;

insert into public.books (id, title, subtitle, description, price, author, cover, file)
values
('vibe-coding', 'เริ่มต้น Vibe Coding', 'จากไอเดียสู่เว็บแรก', 'ฝึกสั่ง AI อย่างมีเป้าหมาย วางแผนหน้าจอ และตรวจโค้ดทีละขั้น', 129, 'Demo E-book Studio', 'cover-vibe', 'vibe-coding.pdf'),
('web-design', 'ออกแบบเว็บให้อ่านง่าย', 'UI ที่เริ่มจากคนใช้', 'หลักการจัดลำดับข้อมูล สี ตัวอักษร และการออกแบบสำหรับมือถือ', 149, 'Demo E-book Studio', 'cover-design', 'web-design.pdf'),
('launch-guide', 'ปล่อยเว็บอย่างมั่นใจ', 'เช็กลิสต์ก่อนขึ้นระบบ', 'รู้จักการตั้งค่า environment, ทดสอบ flow และตรวจความปลอดภัยพื้นฐาน', 169, 'Demo E-book Studio', 'cover-launch', 'launch-guide.pdf')
on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  price = excluded.price,
  author = excluded.author,
  cover = excluded.cover,
  file = excluded.file;
