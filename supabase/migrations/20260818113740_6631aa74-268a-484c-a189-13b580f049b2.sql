DROP TRIGGER IF EXISTS trg_obs_milestone ON public.observations;
DROP TRIGGER IF EXISTS trg_sess_milestone ON public.sessions;
DROP FUNCTION IF EXISTS public.tg_check_obs_milestone();
DROP FUNCTION IF EXISTS public.tg_check_sess_milestone();
DROP FUNCTION IF EXISTS public.grant_milestone_bonus(uuid, text);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (new.id) ON CONFLICT DO NOTHING;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.user_storage_limit_bytes(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT 400::bigint * 1024 * 1024;
$function$;