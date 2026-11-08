-- user_storage_limit_bytes(_user_id) is SECURITY DEFINER and granted to
-- authenticated (20261014150000) because Settings.tsx calls it directly for
-- the signed-in user's own usage display -- but it never checked that
-- _user_id is the caller, so any signed-in user could pass someone else's
-- UUID and read back their exact enterprise storage override.
--
-- Keep the same body (incl. the >0 guard from 20261014151000) but, when the
-- request carries a signed-in user's JWT and that user is neither the
-- requested account nor the admin, answer with the Free default instead of
-- the real value, so nothing about another account is disclosed.
-- Calls with no end-user JWT (auth.uid() IS NULL: service_role edge
-- functions, SQL editor) and calls from the enforce_storage_quota trigger on
-- the caller's own rows are unaffected.
CREATE OR REPLACE FUNCTION public.user_storage_limit_bytes(_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  jwt_email text;
BEGIN
  IF caller IS NOT NULL AND _user_id IS DISTINCT FROM caller THEN
    BEGIN
      jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    EXCEPTION WHEN OTHERS THEN
      jwt_email := '';
    END;
    IF jwt_email <> 'var@kozmos.sk' THEN
      RETURN 400::bigint * 1024 * 1024;
    END IF;
  END IF;

  RETURN COALESCE(
    (SELECT enterprise_storage_mb::bigint * 1024 * 1024
       FROM public.profiles
      WHERE user_id = _user_id AND enterprise_storage_mb > 0),
    400::bigint * 1024 * 1024
  );
END;
$function$;
