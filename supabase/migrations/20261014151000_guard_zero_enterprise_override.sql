-- Root cause of "some observations silently fail to save" reports: six
-- profiles had enterprise_storage_mb / enterprise_ai_scans_per_month set to
-- 0 instead of NULL (from an ad-hoc write outside these migrations, not any
-- code path in this repo — there's no UI for setting these columns). NULL
-- is supposed to mean "use the Free default", but COALESCE() only falls
-- through on NULL, not 0, so user_storage_limit_bytes() returned a literal
-- 0-byte quota: every single INSERT/UPDATE on observations/stars/sessions
-- for those accounts tripped enforce_storage_quota's "used > limit" check
-- and rolled back, for *any* row no matter how small. That data was already
-- corrected directly (reset to NULL for the 6 affected accounts).
--
-- This guards the function itself so a future stray 0 (or a negative value)
-- degrades to the Free default instead of hard-locking the account out of
-- writing anything — an override is only honored when it's a positive
-- number of MB.
CREATE OR REPLACE FUNCTION public.user_storage_limit_bytes(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT enterprise_storage_mb::bigint * 1024 * 1024
       FROM public.profiles
      WHERE user_id = _user_id AND enterprise_storage_mb > 0),
    400::bigint * 1024 * 1024
  );
$function$;
