REVOKE ALL ON FUNCTION public.user_storage_bytes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_storage_limit_bytes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_storage_quota() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_storage_bytes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_storage_limit_bytes(uuid) TO authenticated;