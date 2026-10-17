-- Default privileges grant EXECUTE on new public functions to anon/authenticated
-- directly (not via PUBLIC), so the REVOKE ... FROM PUBLIC in the restore
-- migration left them callable by any signed-in user (e.g. decrement_ocr_usage
-- to reset their own quota). Only service_role (paper-ocr) may call these.
REVOKE EXECUTE ON FUNCTION public.increment_ocr_usage(uuid, date, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_ocr_usage(uuid, date) FROM anon, authenticated;
