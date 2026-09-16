-- 0007_rls.sql — Row Level Security for sensitive patient data.
--
-- The app connects with a direct DATABASE_URL (table owner), which bypasses
-- RLS, so these policies exist to protect the tables from the public Supabase
-- anon/authenticated API surface — not to gate the app's own server actions.
--
-- Written defensively so it is a no-op on PGlite (which has no Supabase roles):
-- policies are only created when the `authenticated` role actually exists.

do $$
declare
  t text;
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    foreach t in array array[
      'patients', 'test_orders', 'test_order_items', 'test_results',
      'reports', 'whatsapp_log'
    ] loop
      execute format('alter table %I enable row level security;', t);
      execute format(
        'drop policy if exists %I on %I;', t || '_authenticated', t);
      execute format(
        'create policy %I on %I for all to authenticated using (true) with check (true);',
        t || '_authenticated', t);
    end loop;
  end if;
end $$;
