-- Atomic check-and-increment for the OCR monthly usage quota. The edge
-- function previously did a plain select, compared count < limit in
-- application code, then a separate update/insert — two concurrent requests
-- could both read the same count, both pass the check, and both write back
-- the same incremented value (undercounting), or both hit the insert branch
-- and rely on the UNIQUE (user_id, used_on) constraint to reject the second
-- (whose error was never checked, silently dropping that scan). This
-- function folds the check and the increment into one statement so
-- concurrent callers serialize on the row's insert/update lock instead of
-- racing on a read.
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

-- Releases a reservation made by increment_ocr_usage when the scan it was
-- reserved for ends up failing (AI error, bad response, etc.), so failed
-- attempts don't count against the user's quota.
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

GRANT EXECUTE ON FUNCTION public.increment_ocr_usage(uuid, date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_ocr_usage(uuid, date) TO service_role;
