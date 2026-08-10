-- paper-ocr moved from a synchronous streamed response to a background job +
-- client polling model (see supabase/functions/paper-ocr/index.ts): the AI
-- gateway itself buffers its whole response instead of streaming it, and the
-- proxy in front of the edge function was observed giving up on the client's
-- HTTP connection around ~90s, well before the model was done answering.
-- These columns let ocr_scan_progress double as the job's status record.
ALTER TABLE public.ocr_scan_progress
  ADD COLUMN status text NOT NULL DEFAULT 'pending',
  ADD COLUMN error_message text,
  ADD COLUMN used integer,
  ADD COLUMN monthly_limit integer,
  ADD COLUMN is_plus boolean;

ALTER TABLE public.ocr_scan_progress
  ADD CONSTRAINT ocr_scan_progress_status_check CHECK (status IN ('pending', 'done', 'error'));
