-- Drop the unused ocr_scan_progress table.
-- It was created for an asynchronous, polling-based OCR flow where the
-- paper-ocr edge function wrote progress rows and the client polled them.
-- That approach was abandoned: paper-ocr is now synchronous and only
-- writes to ocr_usage via the service role. Neither the client nor any
-- edge function references ocr_scan_progress anymore.
DROP TABLE IF EXISTS public.ocr_scan_progress;