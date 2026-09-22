-- Run against a linked/local Supabase database after applying migrations.
begin;

do $$
declare missing_count integer;
begin
  select count(*) into missing_count
  from unnest(array[
    'events','profiles','event_memberships','game_templates','scoring_rules','event_maps','teams','stations',
    'event_games','blocks','rounds','station_setups','event_staff','station_assignments','event_access_codes',
    'devices','device_event_access','station_checkins','checkin_staff','matches','match_participants',
    'match_live_states','team_station_visits','event_device_states','result_submissions','result_revisions','result_values'
  ]) expected(table_name)
  where to_regclass('public.' || expected.table_name) is null;
  if missing_count <> 0 then raise exception '% expected tables are missing', missing_count; end if;

  select count(*) into missing_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any(array[
    'events','profiles','event_memberships','game_templates','scoring_rules','event_maps','teams','stations',
    'event_games','blocks','rounds','station_setups','event_staff','station_assignments','event_access_codes',
    'devices','device_event_access','station_checkins','checkin_staff','matches','match_participants',
    'match_live_states','team_station_visits','event_device_states','result_submissions','result_revisions','result_values'
  ]) and not c.relrowsecurity;
  if missing_count <> 0 then raise exception '% public tables do not have RLS enabled', missing_count; end if;

  select count(*) into missing_count from unnest(array['matches','match_live_states','team_station_visits','result_submissions','result_revisions','result_values']) t(name)
  where not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = t.name);
  if missing_count <> 0 then raise exception '% realtime tables are missing from the publication', missing_count; end if;
end $$;

rollback;
