-- Run against tabedoki only. All fixtures and changes are rolled back.
begin;
insert into auth.users(id) values ('00000000-0000-4000-a000-000000000001'), ('00000000-0000-4000-a000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000001',true);
insert into public.user_data(user_id,data,write_id) values ('00000000-0000-4000-a000-000000000001','{"version":4,"items":[],"templates":[],"shopping":[]}',gen_random_uuid());
do $$ begin
  if (select count(*) from public.user_data) <> 1 then raise exception 'own select failed'; end if;
  begin
    insert into public.user_data(user_id,data,write_id) values ('00000000-0000-4000-a000-000000000002','{"version":4,"items":[],"templates":[],"shopping":[]}',gen_random_uuid());
    raise exception 'foreign insert succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.user_data set user_id = '00000000-0000-4000-a000-000000000002';
    raise exception 'owner reassignment succeeded';
  exception when insufficient_privilege then null; end;
  begin
    update public.user_data set revision = 9;
    raise exception 'revision tamper succeeded';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.user_data;
    raise exception 'delete succeeded';
  exception when insufficient_privilege then null; end;
end $$;
update public.user_data set data = '{"version":4,"items":[],"templates":[],"shopping":[]}', write_id = gen_random_uuid(), previous = data where revision = 1;
do $$ declare affected int; begin
  if (select revision from public.user_data) <> 2 then raise exception 'revision trigger failed'; end if;
  if (select previous from public.user_data) is null then raise exception 'atomic recovery failed'; end if;
  update public.user_data set write_id = gen_random_uuid() where revision = 1;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'stale CAS succeeded'; end if;
  begin
    insert into public.user_data(user_id,data,write_id) values ('00000000-0000-4000-a000-000000000001','{"version":4,"items":[],"templates":[],"shopping":[]}',gen_random_uuid());
    raise exception 'duplicate initial insert succeeded';
  exception when unique_violation then null; end;
  begin
    update public.user_data set data = '{"version":4,"items":[]}';
    raise exception 'invalid shape succeeded';
  exception when check_violation then null; end;
end $$;

-- v5 must be accepted for both the canonical document and the recovery snapshot.
update public.user_data
set data = '{"version":5,"items":[],"templates":[],"shopping":[]}',
    previous = '{"version":5,"items":[],"templates":[],"shopping":[]}',
    write_id = gen_random_uuid()
where user_id = '00000000-0000-4000-a000-000000000001' and revision = 2;
do $ begin
  if (select revision from public.user_data) <> 3 then raise exception 'v5 revision failed'; end if;
  if (select data->>'version' from public.user_data) <> '5' then raise exception 'v5 data rejected'; end if;
  if (select previous->>'version' from public.user_data) <> '5' then raise exception 'v5 recovery rejected'; end if;
  begin
    update public.user_data set data = '{"version":6,"items":[],"templates":[],"shopping":[]}' where revision = 3;
    raise exception 'unknown version accepted';
  exception when check_violation then null; end;
end $;
select set_config('request.jwt.claim.sub','00000000-0000-4000-a000-000000000002',true);
do $$ declare affected int; begin
  if (select count(*) from public.user_data) <> 0 then raise exception 'foreign read visible'; end if;
  update public.user_data set write_id = gen_random_uuid() where user_id = '00000000-0000-4000-a000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'foreign update succeeded'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform * from public.user_data;
    raise exception 'anon read succeeded';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: owner isolation, grants, CAS, recovery, shape, anon' as result;
