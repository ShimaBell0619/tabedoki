begin;
insert into public.reminder_subscriptions
  (id, token_hash, endpoint, p256dh, auth, weekdays, reminder_hour)
values
  ('11111111-1111-4111-8111-111111111111', repeat('a', 64),
   'https://fcm.googleapis.com/wp/fixture', 'fixture-p256', 'fixture-auth', array[1,4,7], 19);
do $$
begin
  if (select count(*) from public.reminder_subscriptions) <> 1 then
    raise exception 'Reminder test insert failed';
  end if;
  if (select count(*) from public.claim_due_registration_reminders()) <> 0
       and extract(hour from now() at time zone 'Asia/Tokyo')::integer <> 19 then
    raise exception 'Reminder sent at an incorrect hour';
  end if;
end;
$$;
set local role authenticated;
do $$
begin
  if has_table_privilege('authenticated','public.reminder_subscriptions','SELECT') then
    raise exception 'Browser role may read subscriptions';
  end if;
  if has_function_privilege('authenticated','public.claim_due_registration_reminders()','EXECUTE') then
    raise exception 'Browser role may claim subscriptions';
  end if;
  if has_function_privilege('authenticated','public.take_reminder_registration_slot(text)','EXECUTE') then
    raise exception 'Browser role may bypass registration quota';
  end if;
end;
$;
reset role;
do $
declare index integer;
begin
  for index in 1..10 loop
    if not public.take_reminder_registration_slot(repeat('b',64)) then
      raise exception 'Initial registration quota rejected too soon';
    end if;
  end loop;
  if public.take_reminder_registration_slot(repeat('b',64)) then
    raise exception 'Registration quota exceeded its limit';
  end if;
end;
$;
rollback;
