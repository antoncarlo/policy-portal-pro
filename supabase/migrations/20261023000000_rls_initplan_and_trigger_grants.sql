-- Due pulizie segnalate dal controllo di Supabase (advisors), senza cambiare il comportamento.
--
-- 1) Quindici regole di accesso ai dati ricalcolavano auth.uid() per ogni riga letta. Con
--    (select auth.uid()) il valore si calcola una volta per richiesta: stessa logica, meno lavoro.
--    Riguarda agent_settings, practice_documents, user_product_permissions, system_settings,
--    activity_logs, expiry_notifications e api_logs. Le regole di practices, clients e degli eventi
--    delle pratiche non erano nell'elenco e non si toccano.
--
-- 2) Sette funzioni che servono solo ai trigger erano richiamabili da chiunque (anche senza accesso)
--    come /rest/v1/rpc/<nome>. Un trigger non richiede il permesso di esecuzione al momento in cui
--    scatta (lo richiede solo a chi lo crea), quindi si toglie a anon e authenticated e resta al
--    ruolo di servizio. Le quattro funzioni di supporto alle regole (has_role, can_view_practice,
--    get_practice_id_from_path, enforce_mfa_on_request) restano com'erano: le usano le regole stesse.

-- ---------------------------------------------------------------- 1) regole di accesso ai dati

alter policy "Admins can view all activity logs" on public.activity_logs
  using (exists (select 1 from public.user_roles where user_roles.user_id = (select auth.uid()) and user_roles.role = 'admin'::public.app_role));

alter policy "Users can view own activity logs" on public.activity_logs
  using ((select auth.uid()) = user_id);

alter policy "Users can insert own agent settings" on public.agent_settings
  with check ((select auth.uid()) = user_id);

alter policy "Users can update own agent settings" on public.agent_settings
  using ((select auth.uid()) = user_id);

alter policy "Users can view own agent settings" on public.agent_settings
  using ((select auth.uid()) = user_id);

alter policy "Admins can view api logs" on public.api_logs
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

alter policy "Users can view their practice notifications" on public.expiry_notifications
  using (practice_id in (select practices.id from public.practices where practices.user_id = (select auth.uid())));

alter policy "Users can delete their practice documents" on public.practice_documents
  using (exists (
    select 1 from public.practices p
    where p.id = practice_documents.practice_id
      and (p.user_id = (select auth.uid()) or public.has_role((select auth.uid()), 'admin'::public.app_role))
  ));

alter policy "Admins can update system settings" on public.system_settings
  using (exists (select 1 from public.user_roles where user_roles.user_id = (select auth.uid()) and user_roles.role = 'admin'::public.app_role));

alter policy "Admins can view system settings" on public.system_settings
  using (exists (select 1 from public.user_roles where user_roles.user_id = (select auth.uid()) and user_roles.role = 'admin'::public.app_role));

alter policy "Admins can manage all product permissions" on public.user_product_permissions
  using (public.has_role((select auth.uid()), 'admin'::public.app_role))
  with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

alter policy "Admins can view all product permissions" on public.user_product_permissions
  using (public.has_role((select auth.uid()), 'admin'::public.app_role));

alter policy "Agents can manage their collaborators product permissions" on public.user_product_permissions
  using (
    public.has_role((select auth.uid()), 'agente'::public.app_role)
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = user_product_permissions.user_id
        and ur.parent_agent_id = (select auth.uid())
        and ur.role = 'collaboratore'::public.app_role
    )
  )
  with check (
    public.has_role((select auth.uid()), 'agente'::public.app_role)
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = user_product_permissions.user_id
        and ur.parent_agent_id = (select auth.uid())
        and ur.role = 'collaboratore'::public.app_role
    )
  );

alter policy "Agents can view their collaborators product permissions" on public.user_product_permissions
  using (exists (
    select 1 from public.user_roles ur
    where ur.user_id = user_product_permissions.user_id
      and ur.parent_agent_id = (select auth.uid())
  ));

alter policy "Users can view their own product permissions" on public.user_product_permissions
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- 2) funzioni dei trigger

revoke all on function public.audit_log_immutable() from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.link_practice_to_batch() from public, anon, authenticated;
revoke all on function public.prevent_profile_delete_with_data() from public, anon, authenticated;
revoke all on function public.queue_practice_created() from public, anon, authenticated;
revoke all on function public.queue_practice_changed() from public, anon, authenticated;
revoke all on function public.queue_document_added() from public, anon, authenticated;

grant execute on function public.audit_log_immutable() to service_role;
grant execute on function public.audit_row_change() to service_role;
grant execute on function public.link_practice_to_batch() to service_role;
grant execute on function public.prevent_profile_delete_with_data() to service_role;
grant execute on function public.queue_practice_created() to service_role;
grant execute on function public.queue_practice_changed() to service_role;
grant execute on function public.queue_document_added() to service_role;
