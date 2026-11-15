-- Remove the never-used anonymous subscription mechanism.
-- Both tables must be empty; no food records or existing user data are touched.
do $$
begin
  if exists(select 1 from public.reminder_subscriptions)
    or exists(select 1 from public.reminder_registration_limits) then
    raise exception 'Anonymous subscriptions exist; migration aborted';
  end if;
end;
$$;

alter table public.reminder_subscriptions add column user_id uuid not null
  references auth.users(id) on delete cascade;
alter table public.reminder_subscriptions drop column token_hash;
create index reminder_subscriptions_user_id on public.reminder_subscriptions(user_id);
drop function public.take_reminder_registration_slot(text);
drop table public.reminder_registration_limits;

-- Preserve default-deny RLS; Edge Functions verify Google users and use service_role.
revoke all on public.reminder_subscriptions from public, anon, authenticated;
