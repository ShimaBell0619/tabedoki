-- Whole-document CAS keeps purchase -> inventory and backup replacement atomic.
create table public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  write_id uuid not null,
  previous jsonb,
  updated_at timestamptz not null default now(),
  constraint valid_data check (
    jsonb_typeof(data) = 'object' and data @> '{"version":4}'::jsonb
    and jsonb_typeof(data->'items') = 'array' and jsonb_typeof(data->'templates') = 'array' and jsonb_typeof(data->'shopping') = 'array'
    and data ?& array['version','items','templates','shopping']
    and jsonb_array_length(data->'items') <= 3000 and jsonb_array_length(data->'templates') <= 50 and jsonb_array_length(data->'shopping') <= 300
    and octet_length(data::text) <= 5242880
  ),
  constraint valid_previous check (previous is null or (jsonb_typeof(previous) = 'object' and previous @> '{"version":4}'::jsonb and octet_length(previous::text) <= 5242880))
);
alter table public.user_data enable row level security;
revoke all on public.user_data from public, anon, authenticated;
grant select on public.user_data to authenticated;
grant insert (user_id, data, write_id) on public.user_data to authenticated;
grant update (data, previous, write_id) on public.user_data to authenticated;
create policy own_read on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy own_insert on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_update on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.bump_user_data_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.bump_user_data_revision() from public, anon, authenticated;
create trigger bump_revision before update on public.user_data for each row execute function public.bump_user_data_revision();
