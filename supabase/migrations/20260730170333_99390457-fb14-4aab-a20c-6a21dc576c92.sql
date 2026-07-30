CREATE TABLE public.ccd_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  constellation text NOT NULL DEFAULT '',
  ra_hours double precision NOT NULL DEFAULT 0,
  dec_deg double precision NOT NULL DEFAULT 0,
  epoch_jd double precision,
  period_days double precision,
  filters text,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ccd_targets TO authenticated;
GRANT ALL ON public.ccd_targets TO service_role;

ALTER TABLE public.ccd_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccd_targets_select_own" ON public.ccd_targets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ccd_targets_insert_own" ON public.ccd_targets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ccd_targets_update_own" ON public.ccd_targets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ccd_targets_delete_own" ON public.ccd_targets FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ccd_targets_set_updated_at BEFORE UPDATE ON public.ccd_targets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX ccd_targets_user_idx ON public.ccd_targets (user_id, constellation, sort_order);