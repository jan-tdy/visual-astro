-- Allow multiple observations per (session, star)
ALTER TABLE public.observations DROP CONSTRAINT IF EXISTS observations_session_id_star_id_key;
DROP INDEX IF EXISTS observations_session_id_star_id_key;

ALTER TABLE public.observations
  ADD COLUMN IF NOT EXISTS row_index integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS observations_session_star_idx
  ON public.observations(session_id, star_id, row_index);