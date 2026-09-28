-- OnlineLearningLab v0.1.0 初始 schema
-- 应用方式见 README：Dashboard SQL Editor 逐段执行，或 pnpm dlx supabase db push --db-url ...

-- ─────────────────────────────────────────────────────────────
-- profiles：账号元数据 + 角色
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'student' check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- documents：PDF 元数据。字节在 R2，本表只存 key + 展示信息
-- ─────────────────────────────────────────────────────────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  object_key text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index documents_created_at_idx on public.documents (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- invite_codes：注册邀请码。code 为可读主键
-- ─────────────────────────────────────────────────────────────
create table public.invite_codes (
  code text primary key check (char_length(code) between 4 and 40),
  max_uses integer not null check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- trigger：auth.users 新增时自动建 student profile
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 邀请码原子消耗：并发安全。WHERE 条件全在单条 UPDATE 内判定
-- ─────────────────────────────────────────────────────────────
create or replace function public.consume_invite_code(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
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
end $$;

-- 补偿：signUp 失败时把次数还回去（风险 R2）
create or replace function public.refund_invite_code(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.invite_codes
     set used_count = greatest(used_count - 1, 0)
   where code = p_code
     and used_count > 0;
  return found;
end $$;

-- ─────────────────────────────────────────────────────────────
-- RLS：应用层已校验角色，RLS 是第二道防线
-- ─────────────────────────────────────────────────────────────
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

-- invite_codes 完全不对客户端开放：仅 service_role 经 API 路由访问

-- RPC 仅 service_role 可调
revoke all on function public.consume_invite_code(text) from public, anon, authenticated;
grant execute on function public.consume_invite_code(text) to service_role;
revoke all on function public.refund_invite_code(text) from public, anon, authenticated;
grant execute on function public.refund_invite_code(text) to service_role;

-- 明确 PostgreSQL GRANT（RLS policy 不会自动授予表级 SQL 权限）
grant usage on schema public to authenticated, service_role;
grant select on public.profiles to authenticated;
grant select, insert, delete on public.documents to authenticated;
revoke all on public.invite_codes from anon, authenticated;
grant all on public.profiles, public.documents, public.invite_codes to service_role;
