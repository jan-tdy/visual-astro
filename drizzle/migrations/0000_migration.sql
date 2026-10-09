REVOKE INSERT, UPDATE, DELETE ON public.ocr_usage FROM authenticated, anon;
DROP POLICY IF EXISTS "ocr_usage_insert_own" ON public.ocr_usage;
DROP POLICY IF EXISTS "ocr_usage_update_own" ON public.ocr_usage;

CREATE TABLE IF NOT EXISTS public.ocr_split_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  split_total integer NOT NULL CHECK (split_total BETWEEN 2 AND 4),
  used_parts integer[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ocr_split_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocr_split_tokens FROM anon, authenticated;
GRANT ALL ON public.ocr_split_tokens TO service_role;