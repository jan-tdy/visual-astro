
CREATE TABLE public.ocr_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  used_on date NOT NULL DEFAULT (now() at time zone 'utc')::date,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, used_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ocr_usage TO authenticated;
GRANT ALL ON public.ocr_usage TO service_role;

ALTER TABLE public.ocr_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_usage_select_own" ON public.ocr_usage
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ocr_usage_insert_own" ON public.ocr_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ocr_usage_update_own" ON public.ocr_usage
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER ocr_usage_set_updated_at
BEFORE UPDATE ON public.ocr_usage
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
