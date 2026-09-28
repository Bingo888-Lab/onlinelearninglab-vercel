-- OnlineLearningLab v0.1.0 初始 schema
-- 分 4 段执行：1-tables.sql → 2-functions.sql → 3-rls.sql → 4-grants.sql
-- 本文件是 4 段的顺序拼接，供 pnpm dlx supabase db push 使用

-- 第 1 段：表与索引
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  object_key text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index documents_created_at_idx on public.documents (created_at desc);

create table public.invite_codes (
  code text primary key check (char_length(code) between 4 and 40),
  max_uses integer not null check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 第 2 段：trigger 与两个 RPC
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 邀请码原子消耗：并发安全。WHERE 条件全在单条 UPDATE 内判定
create or replace function public.consume_invite_code(p_code text)
returns boolean language plpgsql security definer set search_path = public as $fn$
declare
  v_affected integer;
begin
  update public.invite_codes
     set used_count = used_count + 1
   where code = p_code
     and is_active
     and used_count < max_uses
     and (expires_at is null or expires_at > now());
  get diagnostics v_affected = row_count;
  return v_affected > 0;
end $fn$;

-- 补偿：signUp 失败时把次数还回去（风险 R2）
create or replace function public.refund_invite_code(p_code text)
returns boolean language plpgsql security definer set search_path = public as $fn$
begin
  update public.invite_codes
     set used_count = greatest(used_count - 1, 0)
   where code = p_code
     and used_count > 0;
  return found;
end $fn$;

-- 第 3 段：RLS 策略
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.invite_codes enable row level security;

create policy "own profile read" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "authenticated read documents" on public.documents
  for select to authenticated using (true);

create policy "admin insert documents" on public.documents
  for insert to authenticated
  with check (exists (select 1 from public.profiles p
                      where p.id = auth.uid() and p.role = 'admin'));

create policy "admin delete documents" on public.documents
  for delete to authenticated
  using (exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role = 'admin'));

-- 第 4 段：权限。RLS policy 不含表级 GRANT，漏了就全表 403
revoke all on function public.consume_invite_code(text) from public, anon, authenticated;
grant execute on function public.consume_invite_code(text) to service_role;
revoke all on function public.refund_invite_code(text) from public, anon, authenticated;
grant execute on function public.refund_invite_code(text) to service_role;

grant usage on schema public to authenticated, service_role;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.documents to authenticated;
revoke all on public.invite_codes from anon, authenticated;
grant all on public.profiles, public.documents, public.invite_codes to service_role;
