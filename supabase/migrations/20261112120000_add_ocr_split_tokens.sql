-- ocr_split_tokens (used by supabase/functions/paper-ocr for split-scan part
-- claims) was created directly against the live database — it only ever
-- showed up in drizzle/migrations/0000_migration.sql, a drizzle-kit pull of
-- whatever the DB looked like at some point, not an authored, reviewed
-- migration. That left its RLS state (and the fact that it has no RLS
-- policies at all) impossible to audit from this history. This file brings
-- it in sync with the live schema; it is a no-op if already applied.
--
-- No CREATE POLICY here is intentional, not an oversight: anon and
-- authenticated get no grants at all, so RLS being enabled is belt-and-
-- suspenders on top of that. Every access goes through paper-ocr using the
-- service_role key, which bypasses RLS by design.
CREATE TABLE IF NOT EXISTS public.ocr_split_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  split_total integer NOT NULL CHECK (split_total BETWEEN 2 AND 4),
  used_parts integer[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ocr_split_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocr_split_tokens FROM anon, authenticated;
GRANT ALL ON public.ocr_split_tokens TO service_role;
