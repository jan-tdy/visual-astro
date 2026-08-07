CREATE OR REPLACE FUNCTION public.tg_guard_dev_plus_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  jwt_email text;
BEGIN
  IF NEW.dev_plus_override IS DISTINCT FROM OLD.dev_plus_override THEN
    BEGIN
      jwt_email := lower(coalesce(auth.jwt() ->> 'email', ''));
    EXCEPTION WHEN OTHERS THEN
      jwt_email := '';
    END;
    IF jwt_email <> 'var@kozmos.sk' THEN
      NEW.dev_plus_override := OLD.dev_plus_override;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_dev_plus_override ON public.profiles;
CREATE TRIGGER guard_dev_plus_override
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_dev_plus_override();