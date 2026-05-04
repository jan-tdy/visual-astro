
-- Lock down handle_new_user: only used by trigger from auth schema, no API exposure
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Set search_path on tg_set_updated_at
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
