-- tg_guard_enterprise_overrides (20261004190000) reverts any change to
-- enterprise_ai_scans_per_month / enterprise_storage_mb unless the request's
-- JWT carries auth.jwt()->>'email' = 'var@kozmos.sk'. A service_role call
-- (edge function, admin script) and a dashboard/SQL-editor update run with
-- no such JWT at all, so the override is silently reverted -- no error, no
-- effect -- even though both are legitimate ways to apply an
-- admin-negotiated override.
--
-- Replace the personal-email check with a role check: only service_role and
-- the postgres role (SQL editor / dashboard / direct admin connections) may
-- set these columns; every other role, including an authenticated user
-- acting on their own row, gets the change silently reverted exactly as
-- before.
CREATE OR REPLACE FUNCTION public.tg_guard_enterprise_overrides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.enterprise_ai_scans_per_month IS DISTINCT FROM OLD.enterprise_ai_scans_per_month
     OR NEW.enterprise_storage_mb IS DISTINCT FROM OLD.enterprise_storage_mb THEN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
       AND coalesce(auth.role(), '') <> 'service_role' THEN
      NEW.enterprise_ai_scans_per_month := OLD.enterprise_ai_scans_per_month;
      NEW.enterprise_storage_mb := OLD.enterprise_storage_mb;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
