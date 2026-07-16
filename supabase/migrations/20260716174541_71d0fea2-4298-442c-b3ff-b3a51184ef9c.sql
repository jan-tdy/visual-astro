
REVOKE EXECUTE ON FUNCTION public.grant_milestone_bonus(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_check_obs_milestone() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_check_sess_milestone() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_bonus(uuid) FROM PUBLIC, anon;
