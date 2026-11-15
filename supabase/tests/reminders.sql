begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111');
insert into public.reminder_subscriptions
  (id, user_id, endpoint, p256dh, auth, weekdays, reminder_hour)
values
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
    'https://fcm.googleapis.com/wp/fixture', 'fixture-p256', 'fixture-auth', array[1,4,7], 19);

do $$
begin
  if (select count(*) from public.reminder_subscriptions) <> 1 then
    raise exception 'Google-owned reminder insert failed';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='reminder_subscriptions' and column_name='token_hash'
  ) then
    raise exception 'Anonymous device token column remains';
  end if;
  if to_regclass('public.reminder_registration_limits') is not null then
    raise exception 'Anonymous registration-limit table remains';
  end if;
  if to_regprocedure('public.take_reminder_registration_slot(text)') is not null then
    raise exception 'Anonymous registration-limit function remains';
  end if;
  if not has_table_privilege('service_role','public.reminder_subscriptions','SELECT') then
    raise exception 'Trusted dispatcher cannot read subscriptions';
  end if;
end;
$$;
set local role authenticated;
do $$
begin
  if has_table_privilege('authenticated','public.reminder_subscriptions','SELECT')
    or has_table_privilege('authenticated','public.reminder_subscriptions','INSERT')
    or has_table_privilege('authenticated','public.reminder_subscriptions','UPDATE') then
    raise exception 'Authenticated browser may access server-managed subscriptions';
  end if;
  if has_function_privilege('authenticated','public.claim_due_registration_reminders()','EXECUTE') then
    raise exception 'Browser may dispatch notifications';
  end if;
end;
$$;
reset role;
rollback;
