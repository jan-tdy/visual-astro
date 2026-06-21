ALTER TABLE public.observations
  ALTER COLUMN pasos_a TYPE integer USING ROUND(pasos_a)::integer,
  ALTER COLUMN pasos_b TYPE integer USING ROUND(pasos_b)::integer;