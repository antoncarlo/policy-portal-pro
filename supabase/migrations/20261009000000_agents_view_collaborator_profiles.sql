-- Settings > Collaboratori: an agent sees the name, email and phone of their own
-- collaborators. Until now only the user and the administrators could read a profile,
-- so the agent's list could not show who the collaborators were.
create policy "Agents can view their collaborators profiles"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = profiles.id
        and ur.role = 'collaboratore'
        and ur.parent_agent_id = (select auth.uid())
    )
  );
