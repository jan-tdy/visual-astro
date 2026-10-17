-- Closes the remaining INSERT-based bypass of the ocr_usage quota: UPDATE was
-- already revoked in 20261004190000_lock_down_scan_quota_fields.sql, but
-- INSERT was never touched, and ocr_usage_insert_own only checks row
-- ownership (auth.uid() = user_id), not the count value. Any authenticated
-- user could pre-insert their own row for a not-yet-used (user_id, used_on)
-- bucket with a deeply negative count, after which increment_ocr_usage's
-- "WHERE count < _limit" check keeps passing for tens of thousands of scans
-- before the real monthly cap is ever reached — an unlimited-AI-scans bypass
-- with a direct cost on the AI gateway. The only legitimate writer is the
-- SECURITY DEFINER increment_ocr_usage/decrement_ocr_usage RPC pair (service_role
-- only), same as for UPDATE.
--
-- Found during a manual security review and applied directly to the live
-- database at the time; this file brings the migration history in sync
-- with that fix (see also 20261017162100/20261017162200, which restore and
-- lock down the RPC pair itself, found missing/over-permissive live during
-- the same review).
REVOKE INSERT ON public.ocr_usage FROM authenticated;
DROP POLICY IF EXISTS "ocr_usage_insert_own" ON public.ocr_usage;

ALTER TABLE public.ocr_usage
  ADD CONSTRAINT ocr_usage_count_nonnegative CHECK (count >= 0);
