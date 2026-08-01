CREATE TABLE public.ccd_catalogs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ccd_catalogs TO authenticated;
GRANT ALL ON public.ccd_catalogs TO service_role;

ALTER TABLE public.ccd_catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccd_catalogs_select_own" ON public.ccd_catalogs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ccd_catalogs_insert_own" ON public.ccd_catalogs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ccd_catalogs_update_own" ON public.ccd_catalogs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ccd_catalogs_delete_own" ON public.ccd_catalogs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ccd_catalogs_set_updated_at BEFORE UPDATE ON public.ccd_catalogs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX ccd_catalogs_user_idx ON public.ccd_catalogs (user_id, sort_order);

-- One default catalog per user who already has CCD targets, so existing data keeps working.
INSERT INTO public.ccd_catalogs (user_id, name, sort_order)
SELECT DISTINCT user_id, 'Katalóg 1', 0 FROM public.ccd_targets;

ALTER TABLE public.ccd_targets ADD COLUMN catalog_id uuid REFERENCES public.ccd_catalogs (id) ON DELETE CASCADE;

UPDATE public.ccd_targets t
SET catalog_id = c.id
FROM public.ccd_catalogs c
WHERE c.user_id = t.user_id;

ALTER TABLE public.ccd_targets ALTER COLUMN catalog_id SET NOT NULL;

CREATE INDEX ccd_targets_catalog_idx ON public.ccd_targets (catalog_id, sort_order);
