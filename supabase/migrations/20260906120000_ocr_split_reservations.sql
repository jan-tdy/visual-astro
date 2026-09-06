-- A split OCR scan is charged once, on its first crop.  Keep that charge in a
-- server-owned reservation so later crops cannot bypass quota by supplying
-- caller-controlled splitPart/splitTotal values.
CREATE TABLE public.ocr_scan_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_on date NOT NULL,
  split_total integer NOT NULL CHECK (split_total >= 2),
  next_part integer NOT NULL DEFAULT 2,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'released')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ocr_scan_reservations_active_expiry_idx
  ON public.ocr_scan_reservations (expires_at)
  WHERE status = 'active';

ALTER TABLE public.ocr_scan_reservations ENABLE ROW LEVEL SECURITY;

-- Reservations are an Edge Function implementation detail.  The service-role
-- RPCs below bypass RLS; browser roles must never read or mutate the records.
CREATE POLICY "ocr_scan_reservations_no_client_access"
  ON public.ocr_scan_reservations
  AS RESTRICTIVE
  FOR ALL
  TO PUBLIC
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.reserve_ocr_split_scan(
  _user_id uuid,
  _used_on date,
  _limit integer,
  _split_total integer
)
RETURNS TABLE(new_count integer, limit_reached boolean, reservation_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _usage record;
  _reservation_id uuid;
BEGIN
  IF _split_total < 2 THEN
    RAISE EXCEPTION 'invalid split total';
  END IF;

  SELECT * INTO _usage
    FROM public.increment_ocr_usage(_user_id, _used_on, _limit);

  IF NOT _usage.limit_reached THEN
    INSERT INTO public.ocr_scan_reservations (user_id, used_on, split_total)
      VALUES (_user_id, _used_on, _split_total)
      RETURNING id INTO _reservation_id;
  END IF;

  RETURN QUERY SELECT _usage.new_count, _usage.limit_reached, _reservation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_ocr_scan_reservation(
  _reservation_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _reservation public.ocr_scan_reservations%ROWTYPE;
BEGIN
  SELECT * INTO _reservation
    FROM public.ocr_scan_reservations
    WHERE id = _reservation_id AND user_id = _user_id
    FOR UPDATE;

  IF NOT FOUND OR _reservation.status <> 'active' THEN
    RETURN false;
  END IF;

  UPDATE public.ocr_scan_reservations
    SET status = 'released'
    WHERE id = _reservation.id;

  UPDATE public.ocr_usage
    SET count = GREATEST(count - 1, 0)
    WHERE user_id = _reservation.user_id AND used_on = _reservation.used_on;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_ocr_scan_reservation(
  _reservation_id uuid,
  _user_id uuid,
  _split_part integer,
  _split_total integer
)
RETURNS TABLE(is_valid boolean, failure_reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _reservation public.ocr_scan_reservations%ROWTYPE;
BEGIN
  SELECT * INTO _reservation
    FROM public.ocr_scan_reservations
    WHERE id = _reservation_id AND user_id = _user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'invalid'::text;
    RETURN;
  END IF;

  IF _reservation.status <> 'active' THEN
    RETURN QUERY SELECT false, _reservation.status;
    RETURN;
  END IF;

  IF _reservation.expires_at <= now() THEN
    PERFORM public.release_ocr_scan_reservation(_reservation.id, _user_id);
    RETURN QUERY SELECT false, 'expired'::text;
    RETURN;
  END IF;

  IF _split_total <> _reservation.split_total OR _split_part <> _reservation.next_part THEN
    PERFORM public.release_ocr_scan_reservation(_reservation.id, _user_id);
    RETURN QUERY SELECT false, 'invalid_part'::text;
    RETURN;
  END IF;

  UPDATE public.ocr_scan_reservations
    SET next_part = next_part + 1,
        expires_at = now() + interval '15 minutes'
    WHERE id = _reservation.id;

  RETURN QUERY SELECT true, NULL::text;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_ocr_scan_reservation(
  _reservation_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _updated_id uuid;
BEGIN
  UPDATE public.ocr_scan_reservations
    SET status = 'completed'
    WHERE id = _reservation_id
      AND user_id = _user_id
      AND status = 'active'
      AND next_part = split_total + 1
    RETURNING id INTO _updated_id;

  RETURN _updated_id IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_expired_ocr_scan_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _reservation record;
  _released integer := 0;
BEGIN
  FOR _reservation IN
    UPDATE public.ocr_scan_reservations
      SET status = 'released'
      WHERE status = 'active' AND expires_at <= now()
      RETURNING user_id, used_on
  LOOP
    UPDATE public.ocr_usage
      SET count = GREATEST(count - 1, 0)
      WHERE user_id = _reservation.user_id AND used_on = _reservation.used_on;
    _released := _released + 1;
  END LOOP;

  RETURN _released;
END;
$function$;

REVOKE ALL ON TABLE public.ocr_scan_reservations FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_ocr_split_scan(uuid, date, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_ocr_scan_reservation(uuid, uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_ocr_scan_reservation(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_ocr_scan_reservation(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_expired_ocr_scan_reservations() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_ocr_split_scan(uuid, date, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_ocr_scan_reservation(uuid, uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_ocr_scan_reservation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ocr_scan_reservation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_ocr_scan_reservations() TO service_role;
