-- Minimal Supabase Auth stand-ins for CI-only PostgreSQL; never apply to a Supabase project.
-- Real production authentication/permissions remain owned by Supabase.
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, public to authenticated;
grant execute on function auth.uid() to authenticated;
