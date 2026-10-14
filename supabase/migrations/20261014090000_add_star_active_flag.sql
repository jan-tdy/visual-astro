-- Lets an observer deactivate a star in the catalog instead of deleting it:
-- an inactive star drops out of the session editor's entry grid (so it stops
-- cluttering new sessions) while staying in the catalog itself, keeping its
-- id, and keeping every observation ever recorded against it available for
-- graphs/compare/exports.
ALTER TABLE public.stars ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
