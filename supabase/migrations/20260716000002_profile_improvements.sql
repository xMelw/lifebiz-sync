-- Add onboarding_done flag to workspace_members
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_done_at TIMESTAMPTZ;

-- Ensure profiles has an updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'profiles_updated_at'
    AND tgrelid = 'public.profiles'::regclass
  ) THEN
    CREATE TRIGGER profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END;
$$;

-- Ensure profiles RLS allows users to update their own display_name
DO $$
BEGIN
  -- Drop old policies if they exist with different names
  DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
END;
$$;

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
