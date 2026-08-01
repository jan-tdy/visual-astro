-- A single shared "default" CCD catalog, visible read-only to every user until they edit
-- it — at which point the app forks a personal copy for them instead of mutating it.
ALTER TABLE public.ccd_catalogs ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- At most one catalog may be the default.
CREATE UNIQUE INDEX ccd_catalogs_single_default_idx ON public.ccd_catalogs (is_default) WHERE is_default;

-- Promote the oldest existing catalog to default, if none is marked yet.
UPDATE public.ccd_catalogs
SET is_default = true
WHERE id = (SELECT id FROM public.ccd_catalogs ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.ccd_catalogs WHERE is_default);

-- Every authenticated user may read the default catalog and its targets, in addition to
-- their own (existing "_select_own" policies stay as-is). Insert/update/delete stay
-- owner-only — the app forks a copy before writing instead of using these read grants.
CREATE POLICY "ccd_catalogs_select_default" ON public.ccd_catalogs
  FOR SELECT TO authenticated USING (is_default);

CREATE POLICY "ccd_targets_select_default_catalog" ON public.ccd_targets
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ccd_catalogs c
      WHERE c.id = ccd_targets.catalog_id AND c.is_default
    )
  );
