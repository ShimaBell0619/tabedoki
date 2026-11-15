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

-- Test the real claim function at the CI clock, including hours outside the UI's
-- three choices. This constraint change and every fixture roll back below.
alter table public.reminder_subscriptions drop constraint reminder_subscriptions_reminder_hour_check;
delete from public.reminder_subscriptions where id='22222222-2222-4222-8222-222222222222';
insert into public.reminder_subscriptions
  (id,user_id,endpoint,p256dh,auth,weekdays,reminder_hour,enabled,skip_registered,last_registered_on,last_sent_on)
select
  ('22222222-2222-4222-8222-' || lpad(n::text,12,'0'))::uuid,
  '11111111-1111-4111-8111-111111111111',
  'https://fcm.googleapis.com/wp/claim-' || n, 'fixture-p256','fixture-auth',
  case when n=6 then array[(extract(isodow from clock)::integer % 7)+1]
    else array[extract(isodow from clock)::integer] end,
  case when n=7 then (extract(hour from clock)::integer+1)%24 else extract(hour from clock)::integer end,
  n<>5, n<>3,
  case when n in (2,3) then clock::date else null end,
  case when n=4 then clock::date else null end
from generate_series(1,7) n, (select now() at time zone 'Asia/Tokyo' as clock) c;

do $$
declare claimed uuid[];
begin
  select array_agg(id order by id) into claimed from public.claim_due_registration_reminders();
  if claimed is distinct from array[
    '22222222-2222-4222-8222-000000000001'::uuid,
    '22222222-2222-4222-8222-000000000003'::uuid
  ] then
    raise exception 'Claim must respect JST day/hour, registered-day skip, enabled and sent-day guards';
  end if;
  if exists(select 1 from public.claim_due_registration_reminders()) then
    raise exception 'Repeated dispatch may claim the same day twice';
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
set local role anon;
do $$
begin
  if has_table_privilege('anon','public.reminder_subscriptions','SELECT')
    or has_table_privilege('anon','public.reminder_subscriptions','INSERT')
    or has_table_privilege('anon','public.reminder_subscriptions','UPDATE')
    or has_table_privilege('anon','public.reminder_subscriptions','DELETE')
    or has_function_privilege('anon','public.claim_due_registration_reminders()','EXECUTE') then
    raise exception 'Unauthenticated browser may access subscriptions or dispatch';
  end if;
end;
$$;
reset role;
rollback;
