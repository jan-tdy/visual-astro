-- Two quota-bypass holes, both from columns an "update own row" RLS policy
-- exposed for direct write that no client code actually needs:
--
-- 1. ocr_usage.count tracks the monthly AI-scan quota, but
--    "ocr_usage_update_own" let any signed-in user UPDATE their own row
--    directly (e.g. set count back to 0), resetting their quota. The only
--    legitimate writer is the paper-ocr edge function, which goes through
--    the SECURITY DEFINER increment_ocr_usage/decrement_ocr_usage
--    functions (service_role only) added in 20260824120807. Direct client
--    updates were never used for anything real, so drop them.
--
-- 2. profiles.enterprise_ai_scans_per_month / enterprise_storage_mb are
--    meant to be admin-negotiated overrides (see 20260818120000), but
--    "profiles_update_own" lets any signed-in user UPDATE their own
--    profile row with no column restriction, so a user could simply set
--    their own override and raise their allowance. Guard these columns
--    the same way 20260807174237 already guards dev_plus_override:
--    silently revert the change unless the request is from the admin.

REVOKE UPDATE ON public.ocr_usage FROM authenticated;
DROP POLICY IF EXISTS "ocr_usage_update_own" ON public.ocr_usage;

CREATE OR REPLACE FUNCTION public.tg_guard_enterprise_overrides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  jwt_email text;
BEGIN
  IF NEW.enterprise_ai_scans_per_month IS DISTINCT FROM OLD.enterprise_ai_scans_per_month
     OR NEW.enterprise_storage_mb IS DISTINCT FROM OLD.enterprise_storage_mb THEN
    BEGIN
      jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    EXCEPTION WHEN OTHERS THEN
      jwt_email := '';
    END;
    IF jwt_email <> 'var@kozmos.sk' THEN
      NEW.enterprise_ai_scans_per_month := OLD.enterprise_ai_scans_per_month;
      NEW.enterprise_storage_mb := OLD.enterprise_storage_mb;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_enterprise_overrides ON public.profiles;
CREATE TRIGGER guard_enterprise_overrides
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_enterprise_overrides();
