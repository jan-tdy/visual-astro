-- Display name shown in the profile menu avatar (initials). Optional; falls
-- back to the account email when unset. No photo upload — initials only.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
