-- Per-user Enterprise overrides. Everyone defaults to the Free plan (4 AI
-- scans/month, 400 MB storage); these columns let an admin negotiate and
-- grant a higher limit to a specific observer without touching the global
-- Free defaults. NULL means "use the Free default".
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS enterprise_ai_scans_per_month integer,
  ADD COLUMN IF NOT EXISTS enterprise_storage_mb integer;

CREATE OR REPLACE FUNCTION public.user_storage_limit_bytes(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT enterprise_storage_mb::bigint * 1024 * 1024
       FROM public.profiles
      WHERE user_id = _user_id AND enterprise_storage_mb IS NOT NULL),
    400::bigint * 1024 * 1024
  );
$function$;
