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
