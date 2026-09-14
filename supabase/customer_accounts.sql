-- Customer identities and order ownership. Apply after schema.sql.
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  email text not null,
  session_version integer not null default 1,
  created_at timestamptz not null default now(),
  constraint customer_username_format check (username is null or username ~ '^[a-z0-9_]{3,24}$')
);

alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon, authenticated;

alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
create index if not exists orders_customer_id_idx on public.orders(customer_id, created_at desc);

-- Existing confirmed customers retain orders created before account IDs were stored.
update public.orders o set customer_id = u.id
from auth.users u
where o.customer_id is null and lower(o.email) = lower(u.email) and u.email_confirmed_at is not null;

insert into public.customer_profiles (user_id, email)
select id, lower(email) from auth.users where email is not null
on conflict (user_id) do nothing;

create or replace function public.sync_customer_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null then return new; end if;
  if tg_op = 'INSERT' then
    insert into public.customer_profiles (user_id, username, email)
    values (new.id, nullif(lower(new.raw_user_meta_data ->> 'username'), ''), lower(new.email));
  else
    update public.customer_profiles
    set email = lower(new.email),
        session_version = session_version + case when new.encrypted_password is distinct from old.encrypted_password then 1 else 0 end
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_customer_profile_trigger on auth.users;
create trigger sync_customer_profile_trigger
after insert or update of email, encrypted_password on auth.users
for each row execute function public.sync_customer_profile();
