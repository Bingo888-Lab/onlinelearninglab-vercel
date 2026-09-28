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
