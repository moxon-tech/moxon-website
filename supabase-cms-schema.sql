-- MOXON Supabase security and CMS schema.
-- Run this in Supabase SQL Editor.
-- Safe to run multiple times.

-- Cleanup legacy RPC functions (no longer needed after SDK rewrite).
drop function if exists public.moxon_admin_contact_messages();
drop function if exists public.moxon_admin_activity_logs(integer);
drop function if exists public.moxon_is_admin() cascade;

-- Cleanup old admin whitelist table after switching back to Supabase Auth-only admin access.
drop table if exists public.admin_users;

create table if not exists public.cms_sections (
  section_key text primary key,
  section_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id text primary key,
  type text not null default 'contact',
  title text,
  name text,
  phone text,
  email text,
  company text,
  service text,
  message text,
  attachment text,
  attachment_data text,
  raw_fields jsonb not null default '{}'::jsonb,
  seen boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_activity_logs (
  id text primary key,
  action text not null,
  target text,
  detail text,
  actor_name text,
  actor_role text,
  actor_email text,
  actor_avatar text,
  created_at timestamptz not null default now()
);

create table if not exists public.product_categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  category text references public.product_categories(id) on delete set null,
  title text not null,
  kicker text,
  image text,
  description text,
  search text,
  active boolean not null default true,
  featured boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cms_sections enable row level security;
alter table public.contact_messages enable row level security;
alter table public.admin_activity_logs enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;

grant usage on schema public to anon, authenticated;
grant select on table public.cms_sections to anon, authenticated;
grant insert, update, delete on table public.cms_sections to authenticated;
grant insert on table public.contact_messages to anon;
grant select, insert, update, delete on table public.contact_messages to authenticated;
grant select, insert, update, delete on table public.admin_activity_logs to authenticated;
grant select on table public.product_categories to anon, authenticated;
grant insert, update, delete on table public.product_categories to authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

-- Products use created_at as the only source of truth for creation time.
-- Supabase stores timestamptz in UTC; the admin/public UI formats it as Vietnam/local time.
alter table if exists public.products
  add column if not exists created_at timestamptz not null default now();

alter table if exists public.products
  add column if not exists updated_at timestamptz not null default now();

-- Remove the old date-only column if it exists. It can show the wrong day because it has no time zone.
alter table if exists public.products
  drop column if exists date;

-- The UI formats product timestamps directly, so this unrestricted helper view is no longer needed.
drop view if exists public.products_with_vn_time;

-- Product categories: public can only read active categories; signed-in admins can manage all.
drop policy if exists "Public can read active product categories" on public.product_categories;
drop policy if exists "Authenticated users can manage product categories" on public.product_categories;

create policy "Public can read active product categories"
on public.product_categories
for select
to anon, authenticated
using (active = true);

create policy "Authenticated users can manage product categories"
on public.product_categories
for all
to authenticated
using (true)
with check (true);

-- Products: public can only read active products; signed-in admins can manage all.
drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Authenticated users can manage products" on public.products;

create policy "Public can read active products"
on public.products
for select
to anon, authenticated
using (active = true);

create policy "Authenticated users can manage products"
on public.products
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Public can read CMS sections" on public.cms_sections;
drop policy if exists "Authenticated users can manage CMS sections" on public.cms_sections;
drop policy if exists "Public can submit contact messages" on public.contact_messages;
drop policy if exists "Authenticated admins can insert contact messages" on public.contact_messages;
drop policy if exists "Authenticated users can read contact messages" on public.contact_messages;
drop policy if exists "Authenticated users can update contact messages" on public.contact_messages;
drop policy if exists "Authenticated users can delete contact messages" on public.contact_messages;
drop policy if exists "Authenticated users can read admin activity logs" on public.admin_activity_logs;
drop policy if exists "Authenticated users can insert admin activity logs" on public.admin_activity_logs;
drop policy if exists "Authenticated users can delete admin activity logs" on public.admin_activity_logs;
drop policy if exists "Public can insert contact activity logs" on public.admin_activity_logs;

create policy "Public can read CMS sections"
on public.cms_sections
for select
to anon, authenticated
using (true);

create policy "Authenticated users can manage CMS sections"
on public.cms_sections
for all
to authenticated
using (true)
with check (true);

create policy "Public can submit contact messages"
on public.contact_messages
for insert
to anon, authenticated
with check (
  type in ('contact', 'application')
  and length(coalesce(id, '')) between 8 and 80
  and length(coalesce(name, '')) <= 200
  and length(coalesce(phone, '')) <= 50
  and length(coalesce(email, '')) <= 200
  and length(coalesce(company, '')) <= 200
  and length(coalesce(service, '')) <= 250
  and length(coalesce(message, '')) <= 5000
  and (
    nullif(phone, '') is not null
    or nullif(email, '') is not null
  )
);

create policy "Authenticated admins can insert contact messages"
on public.contact_messages
for insert
to authenticated
with check (true);

create policy "Authenticated users can read contact messages"
on public.contact_messages
for select
to authenticated
using (true);

create policy "Authenticated users can update contact messages"
on public.contact_messages
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete contact messages"
on public.contact_messages
for delete
to authenticated
using (true);

create policy "Authenticated users can read admin activity logs"
on public.admin_activity_logs
for select
to authenticated
using (true);

create policy "Authenticated users can insert admin activity logs"
on public.admin_activity_logs
for insert
to authenticated
with check (true);

-- Normalize old public activity logs that were stored without Vietnamese accents.
update public.admin_activity_logs
set
  action = case action
    when 'Gui moi' then 'Gửi mới'
    else action
  end,
  target = case target
    when 'Lien he' then 'Liên hệ'
    when 'Ung tuyen' then 'Ứng tuyển'
    else target
  end,
  actor_role = case actor_role
    when 'Khach lien he' then 'Khách liên hệ'
    when 'Ung vien' then 'Ứng viên'
    when 'Khach truy cap' then 'Khách truy cập'
    else actor_role
  end,
  actor_name = case actor_name
    when 'Khach hang' then 'Khách hàng'
    else actor_name
  end
where action in ('Gui moi')
  or target in ('Lien he', 'Ung tuyen')
  or actor_role in ('Khach lien he', 'Ung vien', 'Khach truy cap')
  or actor_name in ('Khach hang');

create policy "Authenticated users can delete admin activity logs"
on public.admin_activity_logs
for delete
to authenticated
using (true);

-- Public media used by the website.
-- Admin uploads images for products, banners, services, news, partners and brand assets.
-- Public visitors can read these images so the website can display them.
drop policy if exists "Public can read website media" on storage.objects;
drop policy if exists "Authenticated users can upload website media" on storage.objects;
drop policy if exists "Authenticated users can update website media" on storage.objects;
drop policy if exists "Authenticated users can delete website media" on storage.objects;

create policy "Public can read website media"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'moxon-media'
  and (
    name like 'products/%'
    or name like 'aboutpage/%'
    or name like 'about-page/%'
    or name like 'banners/%'
    or name like 'services/%'
    or name like 'news/%'
    or name like 'partners/%'
    or name like 'brand/%'
  )
);

create policy "Authenticated users can upload website media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'moxon-media'
  and (
    name like 'products/%'
    or name like 'aboutpage/%'
    or name like 'about-page/%'
    or name like 'banners/%'
    or name like 'services/%'
    or name like 'news/%'
    or name like 'partners/%'
    or name like 'brand/%'
  )
);

create policy "Authenticated users can update website media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'moxon-media'
  and (
    name like 'products/%'
    or name like 'aboutpage/%'
    or name like 'about-page/%'
    or name like 'banners/%'
    or name like 'services/%'
    or name like 'news/%'
    or name like 'partners/%'
    or name like 'brand/%'
  )
)
with check (
  bucket_id = 'moxon-media'
  and (
    name like 'products/%'
    or name like 'aboutpage/%'
    or name like 'about-page/%'
    or name like 'banners/%'
    or name like 'services/%'
    or name like 'news/%'
    or name like 'partners/%'
    or name like 'brand/%'
  )
);

create policy "Authenticated users can delete website media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'moxon-media'
  and (
    name like 'products/%'
    or name like 'aboutpage/%'
    or name like 'about-page/%'
    or name like 'banners/%'
    or name like 'services/%'
    or name like 'news/%'
    or name like 'partners/%'
    or name like 'brand/%'
  )
);

-- Contact/recruitment attachments.
-- Create a private Storage bucket named "moxon-private" before testing uploads.
-- Public visitors can upload files from forms.
-- Public read is intentionally disabled; admins open/download files through signed URLs.
drop policy if exists "Public can upload contact attachments" on storage.objects;
drop policy if exists "Public can read contact attachments" on storage.objects;
drop policy if exists "Authenticated users can manage contact attachments" on storage.objects;

create policy "Public can upload contact attachments"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'moxon-private'
  and name like 'contact-attachments/%'
);

create policy "Authenticated users can manage contact attachments"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'moxon-private'
  and name like 'contact-attachments/%'
)
with check (
  bucket_id = 'moxon-private'
  and name like 'contact-attachments/%'
);

-- Refresh Supabase/PostgREST schema cache so newly created tables and policies are available to the API.
notify pgrst, 'reload schema';
