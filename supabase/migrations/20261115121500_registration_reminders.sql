-- Registration reminders are device-scoped; no food or account data is copied here.
create table public.reminder_subscriptions (
  id uuid primary key,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  weekdays integer[] not null check (array_length(weekdays, 1) between 1 and 7 and weekdays <@ array[1,2,3,4,5,6,7]),
  reminder_hour integer not null check (reminder_hour in (18, 19, 21)),
  skip_registered boolean not null default true,
  enabled boolean not null default true,
  last_registered_on date,
  last_sent_on date,
  last_test_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index reminder_subscriptions_enabled_hour on public.reminder_subscriptions (reminder_hour) where enabled;

alter table public.reminder_subscriptions enable row level security;
revoke all on public.reminder_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.reminder_subscriptions to service_role;

-- Claim before sending: at most one send attempt per device per JST date.
-- Invoker privileges + explicit grants keep the claim unavailable to browser clients.
create function public.claim_due_registration_reminders()
returns setof public.reminder_subscriptions
language sql security invoker set search_path = ''
as $$
  with local_clock as (
    select now() at time zone 'Asia/Tokyo' as timestamp_jst
  ), due as (
    select s.id
    from public.reminder_subscriptions s, local_clock c
    where s.enabled
      and s.reminder_hour = extract(hour from c.timestamp_jst)::integer
      and extract(isodow from c.timestamp_jst)::integer = any(s.weekdays)
      and (not s.skip_registered or s.last_registered_on is distinct from c.timestamp_jst::date)
      and s.last_sent_on is distinct from c.timestamp_jst::date
    order by s.created_at
    for update of s skip locked
    limit 100
  )
  update public.reminder_subscriptions s
  set last_sent_on = (select timestamp_jst::date from local_clock)
  from due where s.id = due.id
  returning s.*;
$$;
revoke all on function public.claim_due_registration_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_registration_reminders() to service_role;
