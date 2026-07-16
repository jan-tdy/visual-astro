
-- 1. Bonus table
CREATE TABLE public.plus_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reason text NOT NULL,
  milestone_key text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  seen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.plus_bonuses TO authenticated;
GRANT ALL ON public.plus_bonuses TO service_role;

ALTER TABLE public.plus_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own bonuses"
  ON public.plus_bonuses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own bonuses"
  ON public.plus_bonuses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX plus_bonuses_user_expires_idx
  ON public.plus_bonuses (user_id, expires_at DESC);

-- 2. Milestone progress on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS milestone_progress jsonb NOT NULL DEFAULT '{"obs":[],"sess":[],"welcome":false}'::jsonb;

-- 3. has_active_bonus helper
CREATE OR REPLACE FUNCTION public.has_active_bonus(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plus_bonuses
    WHERE user_id = _user_id AND expires_at > now()
  );
$$;

-- 4. Update storage limit to include bonuses
CREATE OR REPLACE FUNCTION public.user_storage_limit_bytes(_user_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_plus boolean := false;
  email text;
BEGIN
  IF public.has_active_subscription(_user_id, 'live') OR public.has_active_subscription(_user_id, 'sandbox') THEN
    is_plus := true;
  END IF;

  IF NOT is_plus AND public.has_active_bonus(_user_id) THEN
    is_plus := true;
  END IF;

  IF NOT is_plus THEN
    BEGIN
      email := lower(coalesce(auth.jwt() ->> 'email', ''));
      IF email = 'var@kozmos.sk' THEN
        is_plus := true;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF is_plus THEN
    RETURN 800::bigint * 1024 * 1024;
  ELSE
    RETURN 200::bigint * 1024 * 1024;
  END IF;
END;
$function$;

-- 5. Milestone grant function
CREATE OR REPLACE FUNCTION public.grant_milestone_bonus(_user_id uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thresholds int[];
  days int;
  reason_prefix text;
  progress_key text;
  prog jsonb;
  granted_arr jsonb;
  granted_set int[];
  total_count int;
  eff int;
  th int;
  max_th int;
  cycles int;
BEGIN
  IF _kind = 'obs' THEN
    thresholds := ARRAY[10, 900, 1000, 1500, 5000, 10000];
    days := 2;
    reason_prefix := 'Bonus za pozorovania';
    progress_key := 'obs';
    SELECT count(*) INTO total_count FROM public.observations WHERE user_id = _user_id;
  ELSIF _kind = 'sess' THEN
    thresholds := ARRAY[50, 120, 500];
    days := 4;
    reason_prefix := 'Bonus za session';
    progress_key := 'sess';
    SELECT count(*) INTO total_count FROM public.sessions WHERE user_id = _user_id;
  ELSE
    RETURN;
  END IF;

  max_th := thresholds[array_length(thresholds, 1)];
  cycles := total_count / max_th;
  eff := total_count - cycles * max_th;

  SELECT milestone_progress INTO prog FROM public.profiles WHERE user_id = _user_id;
  IF prog IS NULL THEN prog := '{"obs":[],"sess":[],"welcome":false}'::jsonb; END IF;
  granted_arr := COALESCE(prog->progress_key, '[]'::jsonb);
  -- Encode cycle within milestone key so a new cycle re-grants automatically
  FOREACH th IN ARRAY thresholds LOOP
    IF eff >= th THEN
      IF NOT (granted_arr @> to_jsonb(cycles * 100000 + th)) THEN
        INSERT INTO public.plus_bonuses (user_id, reason, milestone_key, expires_at)
        VALUES (_user_id,
                reason_prefix || ' (' || th || ')',
                _kind || ':' || cycles || ':' || th,
                now() + (days || ' days')::interval);
        granted_arr := granted_arr || to_jsonb(cycles * 100000 + th);
      END IF;
    END IF;
  END LOOP;
  prog := jsonb_set(prog, ARRAY[progress_key], granted_arr, true);
  UPDATE public.profiles SET milestone_progress = prog WHERE user_id = _user_id;
END;
$$;

-- 6. Trigger functions
CREATE OR REPLACE FUNCTION public.tg_check_obs_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.grant_milestone_bonus(NEW.user_id, 'obs');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_check_sess_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.grant_milestone_bonus(NEW.user_id, 'sess');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obs_milestone ON public.observations;
CREATE TRIGGER trg_obs_milestone
  AFTER INSERT ON public.observations
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_check_obs_milestone();

DROP TRIGGER IF EXISTS trg_sess_milestone ON public.sessions;
CREATE TRIGGER trg_sess_milestone
  AFTER INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_check_sess_milestone();

-- 7. Welcome bonus in handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (new.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.plus_bonuses (user_id, reason, milestone_key, expires_at)
    VALUES (new.id, 'Vitajte v Visual Astro! 2 dni Plus zadarmo.', 'welcome', now() + interval '2 days');
  UPDATE public.profiles
     SET milestone_progress = jsonb_set(coalesce(milestone_progress,'{"obs":[],"sess":[]}'::jsonb), '{welcome}', 'true'::jsonb, true)
   WHERE user_id = new.id;
  RETURN new;
END;
$function$;
