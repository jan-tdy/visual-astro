-- Child rows must reference a parent owned by the same authenticated user.
-- MCP tools also validate ownership, but RLS must enforce this for direct API writes.
DROP POLICY IF EXISTS "obs_insert_own" ON public.observations;
CREATE POLICY "obs_insert_own"
  ON public.observations
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.sessions AS s
      WHERE s.id = observations.session_id
        AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ccd_targets_insert_own" ON public.ccd_targets;
CREATE POLICY "ccd_targets_insert_own"
  ON public.ccd_targets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.ccd_catalogs AS c
      WHERE c.id = ccd_targets.catalog_id
        AND c.user_id = auth.uid()
    )
  );
