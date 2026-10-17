-- Default privileges on this project grant EXECUTE on new public functions
-- to anon/authenticated directly (not via PUBLIC), so the REVOKE ... FROM
-- PUBLIC in 20261017162100_restore_ocr_usage_rpcs.sql left both functions
-- callable by any signed-in user — in particular, decrement_ocr_usage let
-- anyone reset their own monthly OCR-scan quota with a single RPC call,
-- a more direct bypass than the INSERT-based one closed in
-- 20261017162000_revoke_ocr_usage_insert.sql. Found live during a manual
-- security review. Only service_role (paper-ocr) may call these.
REVOKE EXECUTE ON FUNCTION public.increment_ocr_usage(uuid, date, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_ocr_usage(uuid, date) FROM anon, authenticated;
