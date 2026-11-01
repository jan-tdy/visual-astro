create table public.pozor_tab_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  tab text not null,
  created_at timestamptz not null default now()
);

create index idx_pozor_tab_visits_user_id on public.pozor_tab_visits(user_id);
create index idx_pozor_tab_visits_created_at on public.pozor_tab_visits(created_at);

alter table public.pozor_tab_visits enable row level security;

create policy "pozor_tab_visits_select_own"
  on public.pozor_tab_visits for select
  using (auth.uid() = user_id);

create policy "pozor_tab_visits_insert_own"
  on public.pozor_tab_visits for insert
  with check (auth.uid() = user_id);
