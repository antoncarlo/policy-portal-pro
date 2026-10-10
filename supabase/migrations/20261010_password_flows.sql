-- Password flows (forgot password, welcome email, first-login change).
--
-- The server (service role only) looks a user up by email to decide whether a recovery email
-- should be sent and to throttle repeated requests. Nothing here is reachable by the browser.
-- Users created by an administrator carry app_metadata.must_change_password = true until they
-- choose their own password; that flag lives in auth.users and needs no table.

create or replace function public.auth_user_for_email(p_email text)
returns table (id uuid, banned boolean, recovery_sent_at timestamptz, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         (u.banned_until is not null and u.banned_until > now()),
         u.recovery_sent_at,
         u.last_sign_in_at
  from auth.users u
  where lower(u.email) = lower(p_email) and u.deleted_at is null
  limit 1
$$;
revoke all on function public.auth_user_for_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_for_email(text) to service_role;
