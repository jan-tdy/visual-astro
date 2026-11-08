-- plus_bonuses had GRANT UPDATE (all columns) + an "update own row" RLS
-- policy (20260716174530), so any signed-in user could rewrite their own
-- expires_at (or granted_at / reason / milestone_key) and make a bonus
-- never expire. Bonuses are only ever created by the SECURITY DEFINER
-- milestone functions, and no client code writes this table directly.
--
-- Narrow the write surface instead of relying on a revert trigger:
--   * drop the blanket table-level UPDATE grant,
--   * re-grant UPDATE on the single column a client legitimately flips
--     (the "seen" flag), so the RLS policy can only ever touch that.
-- service_role keeps GRANT ALL; SECURITY DEFINER functions are unaffected.
REVOKE UPDATE ON public.plus_bonuses FROM authenticated;
GRANT UPDATE (seen) ON public.plus_bonuses TO authenticated;

-- Defence in depth: if a broader UPDATE grant is ever re-added (e.g. by a
-- table-wide GRANT in a later migration), still revert duration/identity
-- column changes from anyone but service_role / the postgres admin roles.
CREATE OR REPLACE FUNCTION public.tg_guard_plus_bonuses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.expires_at IS DISTINCT FROM OLD.expires_at
      OR NEW.granted_at IS DISTINCT FROM OLD.granted_at
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.reason IS DISTINCT FROM OLD.reason
      OR NEW.milestone_key IS DISTINCT FROM OLD.milestone_key)
     AND session_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.expires_at := OLD.expires_at;
    NEW.granted_at := OLD.granted_at;
    NEW.user_id := OLD.user_id;
    NEW.reason := OLD.reason;
    NEW.milestone_key := OLD.milestone_key;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_guard_plus_bonuses() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_plus_bonuses ON public.plus_bonuses;
CREATE TRIGGER guard_plus_bonuses
BEFORE UPDATE ON public.plus_bonuses
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_plus_bonuses();
