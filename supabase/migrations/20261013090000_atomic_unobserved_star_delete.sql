-- Catalog "Replace" import drops stars that are no longer in the new file,
-- but only when nobody has ever recorded an observation against them. The
-- app previously did this as two round trips (SELECT which dropped ids still
-- have observations, then DELETE the rest) — a window in which a new
-- observation inserted between the two calls would still get its star
-- deleted (and, via observations.star_id's ON DELETE CASCADE, the
-- observation along with it). Folding the check and the delete into one
-- statement makes it atomic: Postgres evaluates NOT EXISTS against the same
-- snapshot the DELETE commits, so nothing can race it.
--
-- No SECURITY DEFINER: this runs with the caller's own privileges, so the
-- existing stars_delete_own / obs_select_own RLS policies (auth.uid() =
-- user_id) apply exactly as they would to a hand-written DELETE, and a user
-- can only ever affect their own rows.
CREATE OR REPLACE FUNCTION public.delete_unobserved_stars(p_star_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
AS $function$
  DELETE FROM public.stars
  WHERE id = ANY(p_star_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.observations o WHERE o.star_id = stars.id
    )
  RETURNING id;
$function$;

REVOKE EXECUTE ON FUNCTION public.delete_unobserved_stars(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_unobserved_stars(uuid[]) TO authenticated;
