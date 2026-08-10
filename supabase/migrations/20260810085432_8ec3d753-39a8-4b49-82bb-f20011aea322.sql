CREATE TABLE public.ocr_scan_progress (
  scan_id uuid NOT NULL,
  part smallint NOT NULL,
  user_id uuid NOT NULL,
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scan_id, part)
);

GRANT SELECT, DELETE ON public.ocr_scan_progress TO authenticated;
GRANT ALL ON public.ocr_scan_progress TO service_role;

ALTER TABLE public.ocr_scan_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_scan_progress_select_own" ON public.ocr_scan_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ocr_scan_progress_delete_own" ON public.ocr_scan_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);