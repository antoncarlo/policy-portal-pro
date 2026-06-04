-- Drop existing permissive UPDATE policy for own practices
DROP POLICY IF EXISTS "Users can update their own practices" ON public.practices;

-- Recreate: users can update their own practices BUT cannot change status
CREATE POLICY "Users can update their own practices (no status change)"
  ON public.practices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (SELECT status FROM public.practices WHERE id = practices.id)
  );

-- NOTE: "Admins can update all practices" and "Agents can update collaborators practices" policies are left untouched.
