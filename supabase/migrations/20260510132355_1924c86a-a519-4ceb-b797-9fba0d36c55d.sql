-- Storage quota enforcement
CREATE OR REPLACE FUNCTION public.user_storage_bytes(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT SUM(pg_column_size(o.*))::bigint FROM public.observations o WHERE o.user_id = _user_id), 0)
    + COALESCE((SELECT SUM(pg_column_size(s.*))::bigint FROM public.stars s WHERE s.user_id = _user_id), 0)
    + COALESCE((SELECT SUM(pg_column_size(se.*))::bigint FROM public.sessions se WHERE se.user_id = _user_id), 0)
    + COALESCE((SELECT SUM(pg_column_size(p.*))::bigint FROM public.profiles p WHERE p.user_id = _user_id), 0);
$$;

CREATE OR REPLACE FUNCTION public.user_storage_limit_bytes(_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_plus boolean := false;
  email text;
BEGIN
  IF public.has_active_subscription(_user_id, 'live') OR public.has_active_subscription(_user_id, 'sandbox') THEN
    is_plus := true;
  END IF;

  IF NOT is_plus THEN
    BEGIN
      email := lower(coalesce(auth.jwt() ->> 'email', ''));
      IF email = 'var@kozmos.sk' THEN
        is_plus := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF is_plus THEN
    RETURN 800::bigint * 1024 * 1024;
  ELSE
    RETURN 200::bigint * 1024 * 1024;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used bigint;
  lim bigint;
BEGIN
  used := public.user_storage_bytes(NEW.user_id);
  lim := public.user_storage_limit_bytes(NEW.user_id);
  IF used > lim THEN
    RAISE EXCEPTION 'Storage limit exceeded: % bytes used of % bytes allowed. Upgrade to Plus for more space.', used, lim
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_storage_quota_observations ON public.observations;
CREATE TRIGGER enforce_storage_quota_observations
AFTER INSERT OR UPDATE ON public.observations
FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota();

DROP TRIGGER IF EXISTS enforce_storage_quota_stars ON public.stars;
CREATE TRIGGER enforce_storage_quota_stars
AFTER INSERT OR UPDATE ON public.stars
FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota();

DROP TRIGGER IF EXISTS enforce_storage_quota_sessions ON public.sessions;
CREATE TRIGGER enforce_storage_quota_sessions
AFTER INSERT OR UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota();