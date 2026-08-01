CREATE TABLE public.pozor_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  elevation double precision NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pozor_locations TO authenticated;
GRANT ALL ON public.pozor_locations TO service_role;

ALTER TABLE public.pozor_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pozor_locations_select_own" ON public.pozor_locations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pozor_locations_insert_own" ON public.pozor_locations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pozor_locations_update_own" ON public.pozor_locations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pozor_locations_delete_own" ON public.pozor_locations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER pozor_locations_set_updated_at BEFORE UPDATE ON public.pozor_locations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX pozor_locations_user_idx ON public.pozor_locations (user_id, sort_order);

-- Seed every existing user with the previously hardcoded locations, so nothing breaks —
-- from here on each user manages their own list in Settings.
INSERT INTO public.pozor_locations (user_id, name, lat, lon, elevation, sort_order)
SELECT u.id, v.name, v.lat, v.lon, v.elevation, v.sort_order
FROM auth.users u
CROSS JOIN (VALUES
  ('Piconcillo', 38.181::double precision, -5.4591::double precision, 0::double precision, 10),
  ('Kolonica', 48.935, 22.2739, 0, 20),
  ('Hlohovec', 48.4202, 17.7969, 0, 30),
  ('Madeira', 32.689, -17.0919, 0, 40)
) AS v(name, lat, lon, elevation, sort_order);
