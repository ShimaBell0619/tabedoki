-- Keep legacy v4 rows readable while enabling the v5 application payload.
-- Preserve all data, revision behavior, grants and authorization policies.
alter table public.user_data
  drop constraint valid_data,
  drop constraint valid_previous,
  add constraint valid_data check (
    jsonb_typeof(data) = 'object'
    and (data @> '{"version":4}'::jsonb or data @> '{"version":5}'::jsonb)
    and jsonb_typeof(data->'items') = 'array'
    and jsonb_typeof(data->'templates') = 'array'
    and jsonb_typeof(data->'shopping') = 'array'
    and data ?& array['version','items','templates','shopping']
    and jsonb_array_length(data->'items') <= 3000
    and jsonb_array_length(data->'templates') <= 50
    and jsonb_array_length(data->'shopping') <= 300
    and octet_length(data::text) <= 5242880
  ),
  add constraint valid_previous check (
    previous is null or (
      jsonb_typeof(previous) = 'object'
      and (previous @> '{"version":4}'::jsonb or previous @> '{"version":5}'::jsonb)
      and octet_length(previous::text) <= 5242880
    )
  );
