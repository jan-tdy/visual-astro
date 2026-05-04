
-- Profile per user (observer code, reference date)
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  obs_code text not null default 'DPV',
  fecha_referencia date not null default '1980-01-01',
  catalog_seeded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

-- Star type enum
create type public.star_type as enum ('VISUAL','BINAR','ECL faint','ECL bright');

-- Star catalog (per user, editable)
create table public.stars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  constellation text not null,
  type public.star_type not null default 'VISUAL',
  vsnet_code text,
  aavso_code text,
  chart_id text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stars_user_const_idx on public.stars(user_id, constellation, sort_order);
alter table public.stars enable row level security;
create policy "stars_select_own" on public.stars for select using (auth.uid() = user_id);
create policy "stars_insert_own" on public.stars for insert with check (auth.uid() = user_id);
create policy "stars_update_own" on public.stars for update using (auth.uid() = user_id);
create policy "stars_delete_own" on public.stars for delete using (auth.uid() = user_id);

-- Sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  observed_at_utc timestamptz not null default now(),
  jd numeric(14,5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_user_idx on public.sessions(user_id, observed_at_utc desc);
alter table public.sessions enable row level security;
create policy "sessions_select_own" on public.sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on public.sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on public.sessions for update using (auth.uid() = user_id);
create policy "sessions_delete_own" on public.sessions for delete using (auth.uid() = user_id);

-- Observations (per session, per star)
create table public.observations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  star_id uuid not null references public.stars(id) on delete cascade,
  a text,
  pasos_a integer,
  pasos_b integer,
  b text,
  limit_value text,
  ut_time text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, star_id)
);
create index observations_session_idx on public.observations(session_id);
alter table public.observations enable row level security;
create policy "obs_select_own" on public.observations for select using (auth.uid() = user_id);
create policy "obs_insert_own" on public.observations for insert with check (auth.uid() = user_id);
create policy "obs_update_own" on public.observations for update using (auth.uid() = user_id);
create policy "obs_delete_own" on public.observations for delete using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger tg_profiles_updated before update on public.profiles for each row execute function public.tg_set_updated_at();
create trigger tg_stars_updated before update on public.stars for each row execute function public.tg_set_updated_at();
create trigger tg_sessions_updated before update on public.sessions for each row execute function public.tg_set_updated_at();
create trigger tg_observations_updated before update on public.observations for each row execute function public.tg_set_updated_at();
