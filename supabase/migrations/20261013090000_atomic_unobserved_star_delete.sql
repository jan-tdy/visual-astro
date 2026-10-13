-- Catalog "Replace" import drops stars that are no longer in the new file,
-- but only when nobody has ever recorded an observation against them. The
-- app previously did this as two round trips (SELECT which dropped ids still
-- have observations, then DELETE the rest) — a window in which a new
-- observation inserted between the two calls would still get its star
-- deleted (and, via observations.star_id's ON DELETE CASCADE, the
-- observation along with it).
--
-- A single `DELETE ... WHERE NOT EXISTS (...)` statement isn't enough to
-- close that window on its own: inserting an observation takes a FOR KEY
-- SHARE lock on its star (standard Postgres FK enforcement), so if that
-- insert is still in flight when this DELETE reaches that star row, the
-- DELETE blocks on the lock — but it already evaluated NOT EXISTS against
-- its own snapshot *before* blocking. Once the insert commits and the lock
-- is released, the DELETE proceeds using that stale "no observations"
-- result instead of re-checking, so the star (and the observation that was
-- just recorded for it) would still be deleted.
--
-- Locking the candidate stars first with SELECT ... FOR UPDATE closes that
-- gap: a concurrent observation insert referencing one of them now blocks on
-- *our* lock instead, so it can only ever commit before we take the lock
-- (in which case our later statement's own fresh READ COMMITTED snapshot
-- sees it and NOT EXISTS correctly comes back false) or after we commit (in
-- which case the star is already gone and that insert fails loudly on the
-- foreign key instead of silently cascading).
--
-- No SECURITY DEFINER: this runs with the caller's own privileges, so the
-- existing stars_delete_own / obs_select_own RLS policies (auth.uid() =
-- user_id) apply exactly as they would to a hand-written DELETE, and a user
-- can only ever affect their own rows.
CREATE OR REPLACE FUNCTION public.delete_unobserved_stars(p_star_ids uuid[])
RETURNS SETOF uuid
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM 1 FROM public.stars WHERE id = ANY(p_star_ids) FOR UPDATE;

  RETURN QUERY
  DELETE FROM public.stars
  WHERE id = ANY(p_star_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.observations o WHERE o.star_id = stars.id
    )
  RETURNING id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_unobserved_stars(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_unobserved_stars(uuid[]) TO authenticated;
