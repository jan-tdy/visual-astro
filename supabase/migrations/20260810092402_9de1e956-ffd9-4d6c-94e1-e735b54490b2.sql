ALTER TABLE public.ocr_scan_progress
  ADD COLUMN status text NOT NULL DEFAULT 'pending',
  ADD COLUMN error_message text,
  ADD COLUMN used integer,
  ADD COLUMN monthly_limit integer,
  ADD COLUMN is_plus boolean;

ALTER TABLE public.ocr_scan_progress
  ADD CONSTRAINT ocr_scan_progress_status_check CHECK (status IN ('pending', 'done', 'error'));