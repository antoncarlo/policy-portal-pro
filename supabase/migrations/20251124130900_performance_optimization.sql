-- Performance Optimization Migration
-- Add indexes to foreign keys for better query performance

-- Add indexes for notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_practice_id ON public.notifications(practice_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Add indexes for practice_documents table
CREATE INDEX IF NOT EXISTS idx_practice_documents_practice_id ON public.practice_documents(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_documents_uploaded_by ON public.practice_documents(uploaded_by);

-- Add indexes for practice_events table
CREATE INDEX IF NOT EXISTS idx_practice_events_practice_id ON public.practice_events(practice_id);
CREATE INDEX IF NOT EXISTS idx_practice_events_created_by ON public.practice_events(created_by);

-- Add indexes for user_roles table
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_created_by ON public.user_roles(created_by);
CREATE INDEX IF NOT EXISTS idx_user_roles_parent_agent_id ON public.user_roles(parent_agent_id);

-- Add indexes for practices table
CREATE INDEX IF NOT EXISTS idx_practices_user_id ON public.practices(user_id);
CREATE INDEX IF NOT EXISTS idx_practices_status ON public.practices(status);
CREATE INDEX IF NOT EXISTS idx_practices_created_at ON public.practices(created_at DESC);

-- Optimize RLS policies by using (SELECT auth.uid()) instead of auth.uid()
-- This prevents re-evaluation for each row

-- Drop and recreate profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Drop and recreate user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert any role" ON public.user_roles;
DROP POLICY IF EXISTS "Agents can view their collaborators' roles" ON public.user_roles;
DROP POLICY IF EXISTS "Agents can create collaborator roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can insert any role"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Agents can view their collaborators' roles"
  ON public.user_roles FOR SELECT
  USING (
    public.has_role((SELECT auth.uid()), 'agente') 
    AND parent_agent_id = (SELECT auth.uid())
  );

CREATE POLICY "Agents can create collaborator roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'agente')
    AND role = 'collaboratore'
    AND parent_agent_id = (SELECT auth.uid())
  );

-- Drop and recreate practices policies
DROP POLICY IF EXISTS "Admins can view all practices" ON public.practices;
DROP POLICY IF EXISTS "Users can view their own practices" ON public.practices;
DROP POLICY IF EXISTS "Agents can view collaborators practices" ON public.practices;
DROP POLICY IF EXISTS "Users can insert their own practices" ON public.practices;
DROP POLICY IF EXISTS "Users can update their own practices" ON public.practices;
DROP POLICY IF EXISTS "Admins can update all practices" ON public.practices;
DROP POLICY IF EXISTS "Agents can update collaborators practices" ON public.practices;
DROP POLICY IF EXISTS "Users can delete their own practices" ON public.practices;
DROP POLICY IF EXISTS "Admins can delete all practices" ON public.practices;

CREATE POLICY "Admins can view all practices"
  ON public.practices FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can view their own practices"
  ON public.practices FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Agents can view collaborators practices"
  ON public.practices FOR SELECT
  USING (
    public.has_role((SELECT auth.uid()), 'agente')
    AND can_view_practice((SELECT auth.uid()), user_id)
  );

CREATE POLICY "Users can insert their own practices"
  ON public.practices FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own practices"
  ON public.practices FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can update all practices"
  ON public.practices FOR UPDATE
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Agents can update collaborators practices"
  ON public.practices FOR UPDATE
  USING (
    public.has_role((SELECT auth.uid()), 'agente')
    AND can_view_practice((SELECT auth.uid()), user_id)
  );

CREATE POLICY "Users can delete their own practices"
  ON public.practices FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can delete all practices"
  ON public.practices FOR DELETE
  USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Drop and recreate practice_documents policies
DROP POLICY IF EXISTS "Users can view their own practice documents" ON public.practice_documents;
DROP POLICY IF EXISTS "Agents can view collaborators practice documents" ON public.practice_documents;
DROP POLICY IF EXISTS "Admins can view all practice documents" ON public.practice_documents;
DROP POLICY IF EXISTS "Users can insert documents to their practices" ON public.practice_documents;
DROP POLICY IF EXISTS "Users can delete their own practice documents" ON public.practice_documents;
DROP POLICY IF EXISTS "Admins can delete all practice documents" ON public.practice_documents;

CREATE POLICY "Users can view their own practice documents"
  ON public.practice_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = practice_id AND p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Agents can view collaborators practice documents"
  ON public.practice_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = practice_id 
      AND can_view_practice((SELECT auth.uid()), p.user_id)
    )
  );

CREATE POLICY "Admins can view all practice documents"
  ON public.practice_documents FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can insert documents to their practices"
  ON public.practice_documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = practice_id AND p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete their own practice documents"
  ON public.practice_documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = practice_id AND p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can delete all practice documents"
  ON public.practice_documents FOR DELETE
  USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Drop and recreate practice_events policies
DROP POLICY IF EXISTS "Users can view events for their practices" ON public.practice_events;
DROP POLICY IF EXISTS "Agents can view events for collaborators practices" ON public.practice_events;
DROP POLICY IF EXISTS "Admins can view all practice events" ON public.practice_events;
DROP POLICY IF EXISTS "Users can insert events for their practices" ON public.practice_events;

CREATE POLICY "Users can view events for their practices"
  ON public.practice_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = practice_id AND p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Agents can view events for collaborators practices"
  ON public.practice_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = practice_id 
      AND can_view_practice((SELECT auth.uid()), p.user_id)
    )
  );

CREATE POLICY "Admins can view all practice events"
  ON public.practice_events FOR SELECT
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Users can insert events for their practices"
  ON public.practice_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.practices p
      WHERE p.id = practice_id AND p.user_id = (SELECT auth.uid())
    )
  );

-- Drop and recreate notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);
