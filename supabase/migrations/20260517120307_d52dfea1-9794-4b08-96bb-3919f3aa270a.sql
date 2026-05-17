ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS name text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS open_portal_after_export jsonb NOT NULL DEFAULT '{"aavso":false,"vsnet":false,"meduza":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS portal_urls jsonb NOT NULL DEFAULT '{"aavso":"https://www.aavso.org/webobs/file/","vsnet":"https://vsnet.kusastro.kyoto-u.ac.jp/vsnet/","meduza":"http://var.astro.cz/en/"}'::jsonb;