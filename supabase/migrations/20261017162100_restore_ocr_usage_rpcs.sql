-- The live database was missing increment_ocr_usage/decrement_ocr_usage
-- entirely (confirmed via direct query during a manual security review:
-- `select proname from pg_proc where proname ilike '%ocr_usage%'` returned
-- neither function, despite 20260905120000_atomic_ocr_usage.sql having
-- introduced them), so every paper-ocr scan was failing with "Usage
-- tracking error" before ever reaching the AI step. Live DB migration
-- history had drifted from this repo (it stopped recording applied
-- migrations at 20260824120807 — a separate issue to reconcile on its
-- own). Restores the exact functions from 20260905120000_atomic_ocr_usage.sql.
CREATE OR REPLACE FUNCTION public.increment_ocr_usage(_user_id uuid, _used_on date, _limit integer)
RETURNS TABLE(new_count integer, limit_reached boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _count integer;
BEGIN
  INSERT INTO public.ocr_usage (user_id, used_on, count)
  VALUES (_user_id, _used_on, 1)
  ON CONFLICT (user_id, used_on) DO UPDATE
    SET count = public.ocr_usage.count + 1
    WHERE public.ocr_usage.count < _limit
  RETURNING public.ocr_usage.count INTO _count;

  IF FOUND THEN
    RETURN QUERY SELECT _count, false;
  ELSE
    SELECT count INTO _count FROM public.ocr_usage
      WHERE user_id = _user_id AND used_on = _used_on;
    RETURN QUERY SELECT _count, true;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrement_ocr_usage(_user_id uuid, _used_on date)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  UPDATE public.ocr_usage
    SET count = GREATEST(count - 1, 0)
    WHERE user_id = _user_id AND used_on = _used_on;
$function$;

REVOKE EXECUTE ON FUNCTION public.increment_ocr_usage(uuid, date, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrement_ocr_usage(uuid, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.increment_ocr_usage(uuid, date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_ocr_usage(uuid, date) TO service_role;
