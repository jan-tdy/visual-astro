-- Prompted by a user-reported "all my observations are gone" incident. The
-- DB had no record of who deleted what or when, so the cause couldn't be
-- confirmed either way. Two independent fixes:
--
-- 1. Security audit turned up TRUNCATE still granted to anon/authenticated
--    on every user-data table — Supabase's default grants cover the full
--    privilege set and RLS policies only ever restricted SELECT/INSERT/
--    UPDATE/DELETE, never TRUNCATE, which bypasses RLS entirely and empties
--    a table outright. PostgREST has no verb that issues TRUNCATE, so this
--    isn't reachable through the app's own REST API today, but it's a
--    needless blast-radius widener if a DB credential (service role key,
--    Postgres password) is ever compromised or misused — standard
--    least-privilege hardening, revoked here since the app never needs it.
--
-- 2. An append-only audit_log, populated by AFTER DELETE triggers on
--    sessions/observations, so a future incident is actually diagnosable:
--    it keeps the full deleted row (for recovery) plus auth.uid() at the
--    time of deletion. auth.uid() is NULL for anything that didn't go
--    through PostgREST with a user JWT — i.e. a raw/admin SQL connection —
--    which is exactly the kind of access that bypasses RLS and grants
--    alike, so a NULL actor_id on a row here is the signal worth noticing.
--    Scoped to DELETE only, not UPDATE: observations alone sees ~20k
--    legitimate autosave UPDATEs, so logging every one would bury the
--    signal (and the table) in noise without helping catch a wipe.

-- service_role bypasses RLS by design, but TRUNCATE on these tables isn't
-- something any service-role caller legitimately needs either, and leaving
-- it in place would let a service-key client empty a table without ever
-- firing the DELETE triggers below — silently defeating the audit log.
REVOKE TRUNCATE ON
  public.sessions, public.observations, public.stars, public.profiles,
  public.ccd_catalogs, public.ccd_targets, public.plus_bonuses,
  public.pozor_locations, public.subscriptions, public.ocr_usage
FROM anon, authenticated, service_role;

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  row_id uuid NOT NULL,
  user_id uuid,
  actor_id uuid,
  old_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Any user can see deletions of their own data; the app's existing admin
-- email (see tg_guard_dev_plus_override) can see everyone's, for monitoring.
CREATE POLICY "audit_log_select_own" ON public.audit_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "audit_log_select_admin" ON public.audit_log
  FOR SELECT TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'var@kozmos.sk');

-- No INSERT/UPDATE/DELETE policy for authenticated/anon at all: only the
-- SECURITY DEFINER trigger below writes here, so nobody can tamper with or
-- erase their own audit trail through the app.

CREATE OR REPLACE FUNCTION public.tg_audit_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, row_id, user_id, actor_id, old_data)
  VALUES (TG_TABLE_NAME, OLD.id, OLD.user_id, auth.uid(), to_jsonb(OLD));
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_audit_sessions_delete
AFTER DELETE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_delete();

CREATE TRIGGER trg_audit_observations_delete
AFTER DELETE ON public.observations
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_delete();
