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
