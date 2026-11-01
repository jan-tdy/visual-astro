-- JapyScope integration: a paired JapyScope Remote (Pi) device reports raw
-- GoTo+tracking events, and the observer decides in the "JapyScope" tab
-- whether each one was actually observed. See docs discussion for the full
-- design (device-code pairing, offline queue, 1.42 min threshold applied on
-- the Pi side, not here).
--
-- Four tables:
--  - telescope_links: one row per paired Pi, keyed by a hash of its device
--    token (the plaintext token itself is never stored).
--  - telescope_pairing_requests: transient device-code handshake state.
--    Never read with the anon/authenticated key — only the edge functions
--    (service role) touch it, so it carries zero RLS policies (RLS enabled,
--    default-deny for every non-service-role caller).
--  - telescope_pair_claim_attempts: per-user lockout counter for
--    telescope-pair-claim, so a logged-in user can't enumerate the 6-digit
--    code space against other people's pending pairing requests.
--  - telescope_events: the actual reported events, owned by the observer
--    once ingested.

CREATE TABLE public.telescope_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  device_token_hash text NOT NULL UNIQUE,
  device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- This project's default privileges grant anon/authenticated ALL on every
-- new table, independent of RLS — revoke down to least privilege rather
-- than relying on RLS (zero policies for a command = deny for that role)
-- as the only layer.
REVOKE ALL ON public.telescope_links FROM anon, authenticated;
GRANT SELECT ON public.telescope_links TO authenticated;
GRANT ALL ON public.telescope_links TO service_role;

ALTER TABLE public.telescope_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telescope_links_select_own" ON public.telescope_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated: a link is only ever
-- created by telescope-pair-claim and revoked by telescope-revoke, both
-- service-role edge functions that bypass RLS by design.

CREATE TABLE public.telescope_pairing_requests (
  id uuid PRIMARY KEY,
  code_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed')),
  user_id uuid,
  plaintext_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- No grants at all for anon/authenticated (not even SELECT) — see the note
-- above telescope_links; this table briefly holds a plaintext device token.
REVOKE ALL ON public.telescope_pairing_requests FROM anon, authenticated;
GRANT ALL ON public.telescope_pairing_requests TO service_role;

ALTER TABLE public.telescope_pairing_requests ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies at all: this table is pairing-handshake state
-- (holds a plaintext device token for a short window), read and written
-- only by service-role edge functions, which bypass RLS. anon/authenticated
-- get zero access.

-- Only one request can be actively claimable per code at a time (two
-- Pis independently rolling the same 6-digit code within the same
-- ~10-minute window is astronomically unlikely, but free to rule out).
CREATE UNIQUE INDEX telescope_pairing_requests_pending_code_idx
  ON public.telescope_pairing_requests (code_hash) WHERE status = 'pending';

-- telescope-pair-claim's lockout state: without this, a logged-in user could
-- brute-force the 10^6 code space against *any* currently-pending request
-- from *any* other account and hijack that pairing. Locks out the calling
-- user_id (not the code or the pairing row — the attack enumerates across
-- all pending rows, not one) after a few wrong guesses.
CREATE TABLE public.telescope_pair_claim_attempts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  failed_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);

REVOKE ALL ON public.telescope_pair_claim_attempts FROM anon, authenticated;
GRANT ALL ON public.telescope_pair_claim_attempts TO service_role;

ALTER TABLE public.telescope_pair_claim_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: same posture as telescope_pairing_requests above — only
-- telescope-pair-claim (service role) ever touches this table.

CREATE TABLE public.telescope_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  device_id uuid NOT NULL REFERENCES public.telescope_links(id),
  object_name text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  ra text,
  dec text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  matched_star_id uuid REFERENCES public.stars(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX telescope_events_user_day_idx ON public.telescope_events (user_id, started_at);

REVOKE ALL ON public.telescope_events FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.telescope_events TO authenticated;
GRANT ALL ON public.telescope_events TO service_role;

ALTER TABLE public.telescope_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telescope_events_select_own" ON public.telescope_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Confirm/dismiss/assign-star all happen as a plain authenticated UPDATE of
-- the observer's own row (no edge function needed for that, unlike the
-- insert path below).
CREATE POLICY "telescope_events_update_own" ON public.telescope_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- No INSERT policy for anon/authenticated: rows are only created by
-- telescope-ingest (service role), which validates the device token and
-- sets user_id itself — a client can never insert an event claiming to be
-- from a device it doesn't hold the token for.

-- telescope_events_update_own's WITH CHECK only proves the row stays the
-- caller's own — it says nothing about *which* columns changed or what
-- matched_star_id points to. Without this trigger, an authenticated client
-- could, on a row it legitimately owns, rewrite event_id/device_id/
-- object_name/started_at/ended_at/ra/dec (the Pi-reported facts this
-- feature exists to preserve) or set matched_star_id to a star_id it does
-- not own (stars has its own RLS, so this wouldn't leak that star's data by
-- itself, but a client should never be able to produce that reference).
-- Only status and matched_star_id (to one of the caller's own stars) are
-- meant to be client-editable.
CREATE FUNCTION public.telescope_events_guard_update() RETURNS trigger AS $$
BEGIN
  IF NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.device_id IS DISTINCT FROM OLD.device_id
    OR NEW.object_name IS DISTINCT FROM OLD.object_name
    OR NEW.started_at IS DISTINCT FROM OLD.started_at
    OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
    OR NEW.ra IS DISTINCT FROM OLD.ra
    OR NEW.dec IS DISTINCT FROM OLD.dec
  THEN
    RAISE EXCEPTION 'telescope_events: only status and matched_star_id can be updated';
  END IF;
  IF NEW.matched_star_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.stars s WHERE s.id = NEW.matched_star_id AND s.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'telescope_events: matched_star_id must reference one of your own stars';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Runs for every UPDATE, including the service role's own (telescope-ingest
-- never updates rows, but this keeps the guarantee unconditional either way).
CREATE TRIGGER telescope_events_guard_update_trigger
  BEFORE UPDATE ON public.telescope_events
  FOR EACH ROW EXECUTE FUNCTION public.telescope_events_guard_update();
