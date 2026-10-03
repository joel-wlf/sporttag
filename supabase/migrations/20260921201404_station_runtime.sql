begin;

-- =========================================================================
-- Station-Laufzeit: Offline-Paket, Check-in-Sync, Ergebnis-Korrekturweg,
-- Gerätezustand, Abschlussmanifest und Abgleichprüfung.
-- Siehe docs/datenkonzept.md Abschnitt 8.2, 11 und 12.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Vollständiges Offline-Paket für ein Gerät mit Eventzugriff.
--    security invoker: RLS der zugrunde liegenden Tabellen greift unverändert;
--    ein einzelnes SELECT liefert einen konsistenten Snapshot.
-- -------------------------------------------------------------------------
create or replace function public.get_station_package(p_event_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'server_time', now(),
    'event', (
      select jsonb_build_object(
        'id', e.id, 'name', e.name, 'motto', e.motto, 'event_date', e.event_date,
        'timezone', e.timezone, 'status', e.status, 'plan_version', e.plan_version,
        'staff_assignment_mode', e.staff_assignment_mode,
        'venue_north', e.venue_north, 'venue_south', e.venue_south,
        'venue_east', e.venue_east, 'venue_west', e.venue_west
      )
      from public.events e where e.id = p_event_id
    ),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'number', t.number, 'color', t.color
      ) order by t.number nulls last, t.name)
      from public.teams t where t.event_id = p_event_id
    ), '[]'::jsonb),
    'stations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'location', s.location,
        'latitude', s.latitude, 'longitude', s.longitude, 'arrival_notes', s.arrival_notes
      ) order by s.name)
      from public.stations s where s.event_id = p_event_id
    ), '[]'::jsonb),
    'scoring_rules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sr.id, 'name', sr.name, 'mode', sr.mode, 'config', sr.config
      ))
      from public.scoring_rules sr where sr.event_id = p_event_id
    ), '[]'::jsonb),
    'event_games', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'description', g.description, 'rules', g.rules,
        'referee_notes', g.referee_notes, 'materials', g.materials,
        'default_duration_seconds', g.default_duration_seconds,
        'measurement_type', g.measurement_type, 'unit', g.unit,
        'comparison_direction', g.comparison_direction,
        'min_teams', g.min_teams, 'max_teams', g.max_teams, 'allow_ties', g.allow_ties,
        'tools_config', g.tools_config, 'scoring_rule_id', g.scoring_rule_id
      ))
      from public.event_games g where g.event_id = p_event_id
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.name, 'kind', b.kind, 'position', b.position,
        'starts_at', b.starts_at, 'ends_at', b.ends_at
      ) order by b.position)
      from public.blocks b where b.event_id = p_event_id
    ), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'block_id', r.block_id, 'label', r.label, 'position', r.position,
        'kind', r.kind, 'starts_at', r.starts_at, 'ends_at', r.ends_at
      ) order by r.position)
      from public.rounds r where r.event_id = p_event_id
    ), '[]'::jsonb),
    'station_setups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', su.id, 'block_id', su.block_id, 'station_id', su.station_id,
        'event_game_id', su.event_game_id, 'notes', su.notes
      ))
      from public.station_setups su where su.event_id = p_event_id
    ), '[]'::jsonb),
    'event_staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id, 'display_name', st.display_name, 'notes', st.notes
      ) order by st.display_name)
      from public.event_staff st where st.event_id = p_event_id
    ), '[]'::jsonb),
    'station_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sa.id, 'staff_id', sa.staff_id, 'station_setup_id', sa.station_setup_id
      ))
      from public.station_assignments sa where sa.event_id = p_event_id
    ), '[]'::jsonb),
    'game_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ga.id, 'staff_id', ga.staff_id, 'event_game_id', ga.event_game_id
      ))
      from public.game_assignments ga where ga.event_id = p_event_id
    ), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'round_id', m.round_id, 'station_setup_id', m.station_setup_id,
        'status', m.status, 'counts_for_ranking', m.counts_for_ranking,
        'current_result_version', m.current_result_version,
        'scoring_rule_id', m.scoring_rule_id,
        'participants', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', mp.id, 'team_id', mp.team_id, 'slot', mp.slot
          ) order by mp.slot), '[]'::jsonb)
          from public.match_participants mp where mp.match_id = m.id
        )
      ))
      from public.matches m where m.event_id = p_event_id
    ), '[]'::jsonb),
    'current_result_values', coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id', crv.match_id, 'version', crv.version, 'recorded_at', crv.recorded_at,
        'participant_id', crv.participant_id, 'team_id', crv.team_id,
        'measured_value', crv.measured_value, 'placement', crv.placement
      ))
      from public.current_result_values crv where crv.event_id = p_event_id
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.get_station_package(uuid) from public, anon;
grant execute on function public.get_station_package(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- 2. Check-in-Synchronisierung: idempotenter Upsert von station_checkins und
--    checkin_staff. Schließt jeden anderen aktiven Check-in desselben
--    Gerätezugangs, damit der partielle Unique-Index gültig bleibt.
-- -------------------------------------------------------------------------
create or replace function public.sync_station_checkin(
  p_id uuid,
  p_event_id uuid,
  p_station_setup_id uuid,
  p_device_id uuid,
  p_checked_in_at timestamptz,
  p_checked_out_at timestamptz default null,
  p_staff_ids uuid[] default '{}'
)
returns public.station_checkins
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access public.device_event_access;
  v_row public.station_checkins;
  v_staff_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;

  select * into v_access from public.device_event_access dea
  where dea.event_id = p_event_id and dea.device_id = p_device_id
    and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null;
  if v_access.id is null then raise exception 'device access is not authorized for this event'; end if;

  if not exists (
    select 1 from public.station_setups su where su.id = p_station_setup_id and su.event_id = p_event_id
  ) then
    raise exception 'station setup not found';
  end if;

  -- Beendet jeden anderen aktiven Check-in desselben Gerätezugangs (höchstens
  -- ein aktiver Check-in gleichzeitig, siehe datenkonzept.md Abschnitt 12).
  update public.station_checkins
  set checked_out_at = least(p_checked_in_at, now())
  where event_id = p_event_id and device_access_id = v_access.id
    and checked_out_at is null and id <> p_id;

  insert into public.station_checkins (
    id, event_id, station_setup_id, device_access_id, checked_in_at, checked_out_at
  ) values (
    p_id, p_event_id, p_station_setup_id, v_access.id, p_checked_in_at, p_checked_out_at
  )
  on conflict (event_id, id) do update set
    checked_out_at = excluded.checked_out_at
  returning * into v_row;

  delete from public.checkin_staff where checkin_id = p_id and event_id = p_event_id
    and staff_id <> all (coalesce(p_staff_ids, '{}'));
  foreach v_staff_id in array coalesce(p_staff_ids, '{}') loop
    insert into public.checkin_staff (checkin_id, staff_id, event_id)
    values (p_id, v_staff_id, p_event_id)
    on conflict (checkin_id, staff_id) do nothing;
  end loop;

  return v_row;
end;
$$;
revoke execute on function public.sync_station_checkin(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid[]) from public, anon;
grant execute on function public.sync_station_checkin(uuid,uuid,uuid,uuid,timestamptz,timestamptz,uuid[]) to authenticated;

-- -------------------------------------------------------------------------
-- 3. submit_result: Autorisierung über den *aktuellen* aktiven Gerätezugang
--    (nicht mehr zwingend denselben device_access_id wie beim Check-in), und
--    Korrekturen (base_result_version > 0) laufen als needs_review statt
--    automatisch übernommen zu werden.
-- -------------------------------------------------------------------------
create or replace function public.submit_result(
  p_request_id uuid,
  p_event_id uuid,
  p_match_id uuid,
  p_device_id uuid,
  p_device_access_id uuid,
  p_checkin_id uuid,
  p_local_sequence bigint,
  p_base_result_version integer,
  p_plan_version integer,
  p_payload jsonb,
  p_payload_hash text,
  p_captured_at timestamptz,
  p_reason text default null
)
returns table (request_id uuid, payload_hash text, status text, result_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_existing public.result_submissions%rowtype;
  v_revision_id uuid;
  v_version integer;
  v_access public.device_event_access;
  v_status text;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload->'values') <> 'array' then
    raise exception 'invalid submission payload';
  end if;

  select * into v_existing from public.result_submissions rs where rs.request_id = p_request_id;
  if found then
    if v_existing.payload_hash <> p_payload_hash or v_existing.payload <> p_payload then
      raise exception 'request_id was already used with different content';
    end if;
    return query select v_existing.request_id, v_existing.payload_hash, v_existing.status,
      (select rr.version from public.result_revisions rr where rr.request_id = p_request_id);
    return;
  end if;

  -- Der aktuelle aktive Gerätezugang zählt, nicht zwingend derselbe wie beim
  -- Check-in: ein erneuter Codebeitritt nach Sitzungsverlust darf frühere
  -- Check-ins des vorherigen Zugangs weiter verwenden dürfen.
  select * into v_access from public.device_event_access dea
  where dea.id = p_device_access_id and dea.event_id = p_event_id
    and dea.device_id = p_device_id and dea.auth_user_id = (select auth.uid())
    and dea.revoked_at is null;
  if v_access.id is null then
    raise exception 'device access is not authorized for this event';
  end if;

  if not exists (
    select 1 from public.station_checkins sci
    join public.matches m on m.event_id = p_event_id and m.id = p_match_id
    where sci.id = p_checkin_id and sci.event_id = p_event_id
      and sci.station_setup_id = m.station_setup_id
  ) then
    raise exception 'check-in does not match this station setup';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id and m.event_id = p_event_id for update;
  if not found then raise exception 'match not found'; end if;

  -- Korrekturen (Basisversion > 0) werden nie automatisch übernommen; sie
  -- brauchen eine Organisatorenbestätigung (datenkonzept.md Abschnitt 5).
  v_status := case
    when p_base_result_version > 0 then 'needs_review'
    when v_match.current_result_version = p_base_result_version
      and v_match.status <> 'cancelled'
      and (select e.plan_version from public.events e where e.id = p_event_id) = p_plan_version
      then 'accepted'
    else 'conflict'
  end;

  insert into public.result_submissions (
    request_id,event_id,match_id,device_id,device_access_id,checkin_id,local_sequence,
    base_result_version,plan_version,payload,payload_hash,status,captured_at
  ) values (
    p_request_id,p_event_id,p_match_id,p_device_id,v_access.id,p_checkin_id,p_local_sequence,
    p_base_result_version,p_plan_version,p_payload,p_payload_hash,v_status,p_captured_at
  );

  insert into public.event_device_states (event_id, device_id, downloaded_plan_version, last_reported_sequence)
  values (p_event_id, p_device_id, p_plan_version, p_local_sequence)
  on conflict (event_id, device_id) do update set
    last_reported_sequence = greatest(public.event_device_states.last_reported_sequence, excluded.last_reported_sequence),
    final_sequence = case
      when public.event_device_states.final_sequence is not null
        and excluded.last_reported_sequence > public.event_device_states.final_sequence
      then null else public.event_device_states.final_sequence end,
    reconciled_at = case
      when public.event_device_states.final_sequence is not null
        and excluded.last_reported_sequence > public.event_device_states.final_sequence
      then null else public.event_device_states.reconciled_at end,
    updated_at = now();

  if v_status <> 'accepted' then
    return query select p_request_id, p_payload_hash, v_status, null::integer;
    return;
  end if;

  if (select count(*) from jsonb_array_elements(p_payload->'values')) <>
     (select count(*) from public.match_participants mp where mp.match_id = p_match_id) then
    raise exception 'submission must contain exactly one value per match participant';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'values') value
    left join public.match_participants mp
      on mp.id = (value->>'participant_id')::uuid and mp.match_id = p_match_id
    where mp.id is null
  ) then raise exception 'submission contains an invalid participant'; end if;
  if (select count(distinct value->>'participant_id') from jsonb_array_elements(p_payload->'values') value) <>
     (select count(*) from jsonb_array_elements(p_payload->'values')) then
    raise exception 'submission contains duplicate participants';
  end if;

  v_version := v_match.current_result_version + 1;
  insert into public.result_revisions(event_id,match_id,version,reason,request_id)
  values (p_event_id,p_match_id,v_version,p_reason,p_request_id)
  returning id into v_revision_id;

  insert into public.result_values(revision_id,participant_id,event_id,match_id,measured_value,placement)
  select v_revision_id, (value->>'participant_id')::uuid, p_event_id, p_match_id,
    nullif(value->>'measured_value','')::numeric,
    nullif(value->>'placement','')::integer
  from jsonb_array_elements(p_payload->'values') value;

  update public.matches set current_result_version = v_version, status = 'completed', updated_at = now()
  where id = p_match_id;

  return query select p_request_id, p_payload_hash, 'accepted'::text, v_version;
end;
$$;
revoke execute on function public.submit_result(uuid,uuid,uuid,uuid,uuid,uuid,bigint,integer,integer,jsonb,text,timestamptz,text) from public, anon;
grant execute on function public.submit_result(uuid,uuid,uuid,uuid,uuid,uuid,bigint,integer,integer,jsonb,text,timestamptz,text) to authenticated;

-- -------------------------------------------------------------------------
-- 4. Gerätezustand melden (Heartbeat), unabhängig von einer Ergebnisabgabe.
-- -------------------------------------------------------------------------
create or replace function public.report_device_state(
  p_event_id uuid,
  p_device_id uuid,
  p_plan_version integer,
  p_last_sequence bigint default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.device_event_access dea
    where dea.event_id = p_event_id and dea.device_id = p_device_id
      and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null
  ) then
    raise exception 'device access is not authorized for this event';
  end if;

  insert into public.event_device_states (event_id, device_id, downloaded_plan_version, last_reported_sequence)
  values (p_event_id, p_device_id, p_plan_version, p_last_sequence)
  on conflict (event_id, device_id) do update set
    downloaded_plan_version = excluded.downloaded_plan_version,
    last_reported_sequence = greatest(public.event_device_states.last_reported_sequence, excluded.last_reported_sequence),
    updated_at = now();

  update public.devices set last_seen_at = now(), updated_at = now() where id = p_device_id;
end;
$$;
revoke execute on function public.report_device_state(uuid,uuid,integer,bigint) from public, anon;
grant execute on function public.report_device_state(uuid,uuid,integer,bigint) to authenticated;

-- -------------------------------------------------------------------------
-- 5. Abschlussmanifest: prüft Lückenlosigkeit und Inhaltsübereinstimmung.
-- -------------------------------------------------------------------------
create or replace function public.submit_device_manifest(
  p_event_id uuid,
  p_device_id uuid,
  p_final_sequence bigint,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing bigint[];
  v_mismatched jsonb;
  v_complete boolean;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.device_event_access dea
    where dea.event_id = p_event_id and dea.device_id = p_device_id
      and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null
  ) then
    raise exception 'device access is not authorized for this event';
  end if;
  if jsonb_typeof(p_entries) <> 'array' then raise exception 'entries must be a json array'; end if;

  select coalesce(array_agg(s.seq), '{}') into v_missing
  from generate_series(1, greatest(p_final_sequence, 0)) as s(seq)
  where p_final_sequence > 0 and not exists (
    select 1 from jsonb_array_elements(p_entries) e
    where (e->>'local_sequence')::bigint = s.seq
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'request_id', e->>'request_id', 'local_sequence', (e->>'local_sequence')::bigint
  )), '[]'::jsonb) into v_mismatched
  from jsonb_array_elements(p_entries) e
  left join public.result_submissions rs
    on rs.request_id = (e->>'request_id')::uuid and rs.event_id = p_event_id
  where rs.request_id is null or rs.payload_hash <> (e->>'payload_hash');

  v_complete := array_length(v_missing, 1) is null and jsonb_array_length(v_mismatched) = 0;

  insert into public.event_device_states (event_id, device_id, downloaded_plan_version, last_reported_sequence, final_sequence, reconciled_at)
  values (p_event_id, p_device_id, 1, p_final_sequence, p_final_sequence, case when v_complete then now() else null end)
  on conflict (event_id, device_id) do update set
    last_reported_sequence = greatest(public.event_device_states.last_reported_sequence, p_final_sequence),
    final_sequence = case when v_complete then p_final_sequence else null end,
    reconciled_at = case when v_complete then now() else null end,
    updated_at = now();

  update public.devices set last_seen_at = now(), updated_at = now() where id = p_device_id;

  return jsonb_build_object(
    'complete', v_complete,
    'missing_sequences', to_jsonb(coalesce(v_missing, '{}')),
    'mismatched', v_mismatched
  );
end;
$$;
revoke execute on function public.submit_device_manifest(uuid,uuid,bigint,jsonb) from public, anon;
grant execute on function public.submit_device_manifest(uuid,uuid,bigint,jsonb) to authenticated;

-- -------------------------------------------------------------------------
-- 6. Erwartete Geräte, Ereignis-Abgleichsstand und -prüfung.
-- -------------------------------------------------------------------------
alter table public.event_device_states add column expected boolean not null default true;
alter table public.events add column reconciled_at timestamptz;

create or replace function public.set_device_expected(p_event_id uuid, p_device_id uuid, p_expected boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_event_organizer(p_event_id) then raise exception 'organizer membership required'; end if;
  insert into public.event_device_states (event_id, device_id, downloaded_plan_version, expected)
  values (p_event_id, p_device_id, 1, p_expected)
  on conflict (event_id, device_id) do update set expected = p_expected, updated_at = now();
end;
$$;
revoke execute on function public.set_device_expected(uuid,uuid,boolean) from public, anon;
grant execute on function public.set_device_expected(uuid,uuid,boolean) to authenticated;

create or replace function public.check_event_reconciliation(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_issues jsonb := '[]'::jsonb;
begin
  if not private.has_event_access(p_event_id) then raise exception 'event access required'; end if;

  -- Jeder aktive Gerätezugang gilt als erwartet, sofern er nicht ausdrücklich
  -- als nicht erwartet markiert wurde (auch wenn das Gerät sich noch nie
  -- gemeldet hat, siehe datenkonzept.md Abschnitt 11.5).
  if exists (
    select 1 from public.device_event_access dea
    left join public.event_device_states eds on eds.event_id = dea.event_id and eds.device_id = dea.device_id
    where dea.event_id = p_event_id and dea.revoked_at is null
      and coalesce(eds.expected, true)
      and eds.reconciled_at is null
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'device_not_reconciled', 'severity', 'error',
      'message', 'Mindestens ein erwartetes Gerät hat noch kein bestätigtes Abschlussmanifest.');
  end if;

  if exists (
    select 1 from public.result_submissions rs
    where rs.event_id = p_event_id and rs.status in ('conflict','needs_review')
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'open_conflicts', 'severity', 'error',
      'message', 'Es liegen ungeklärte Konflikte oder Korrekturvorschläge vor.');
  end if;

  if exists (
    select 1 from public.matches m
    where m.event_id = p_event_id and m.status not in ('completed','cancelled')
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'open_matches', 'severity', 'error',
      'message', 'Es gibt Matches ohne Ergebnis, die weder abgeschlossen noch abgesagt sind.');
  end if;

  return v_issues;
end;
$$;
revoke execute on function public.check_event_reconciliation(uuid) from public, anon;
grant execute on function public.check_event_reconciliation(uuid) to authenticated;

create or replace function public.confirm_event_reconciliation(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_issues jsonb;
begin
  if not private.is_event_organizer(p_event_id) then raise exception 'organizer membership required'; end if;
  v_issues := public.check_event_reconciliation(p_event_id);
  if jsonb_array_length(v_issues) > 0 then
    raise exception 'event is not ready for reconciliation: %', v_issues;
  end if;
  update public.events set reconciled_at = now() where id = p_event_id;
end;
$$;
revoke execute on function public.confirm_event_reconciliation(uuid) from public, anon;
grant execute on function public.confirm_event_reconciliation(uuid) to authenticated;

-- Eine neue Abgabe nach bestätigtem Abschluss hebt die Bestätigung wieder auf.
create or replace function private.guard_reset_reconciliation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.events set reconciled_at = null
  where id = new.event_id and reconciled_at is not null;
  return new;
end;
$$;
revoke execute on function private.guard_reset_reconciliation() from public, anon, authenticated;

create trigger result_submissions_reset_reconciliation
  after insert on public.result_submissions
  for each row execute function private.guard_reset_reconciliation();

-- -------------------------------------------------------------------------
-- 7. Organisatorenübersicht über den Gerätesync-Zustand je Event.
-- -------------------------------------------------------------------------
create or replace function public.device_sync_overview(p_event_id uuid)
returns table (
  device_id uuid,
  label text,
  last_seen_at timestamptz,
  access_id uuid,
  granted_at timestamptz,
  revoked_at timestamptz,
  expected boolean,
  downloaded_plan_version integer,
  current_plan_version integer,
  last_reported_sequence bigint,
  received_count bigint,
  missing_sequences bigint[],
  accepted_count bigint,
  conflict_count bigint,
  needs_review_count bigint,
  final_sequence bigint,
  reconciled_at timestamptz,
  active_checkin_station_id uuid,
  active_checkin_block_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_event_organizer(p_event_id) then raise exception 'organizer membership required'; end if;

  return query
  select
    d.id, d.label, d.last_seen_at,
    dea.id, dea.granted_at, dea.revoked_at,
    coalesce(eds.expected, true),
    eds.downloaded_plan_version,
    (select e.plan_version from public.events e where e.id = p_event_id),
    coalesce(eds.last_reported_sequence, 0),
    (select count(*) from public.result_submissions rs where rs.event_id = p_event_id and rs.device_id = d.id),
    (
      select coalesce(array_agg(s.seq), '{}')
      from generate_series(1, coalesce(eds.last_reported_sequence, 0)) as s(seq)
      where not exists (
        select 1 from public.result_submissions rs
        where rs.event_id = p_event_id and rs.device_id = d.id and rs.local_sequence = s.seq
      )
    ),
    (select count(*) from public.result_submissions rs where rs.event_id = p_event_id and rs.device_id = d.id and rs.status = 'accepted'),
    (select count(*) from public.result_submissions rs where rs.event_id = p_event_id and rs.device_id = d.id and rs.status = 'conflict'),
    (select count(*) from public.result_submissions rs where rs.event_id = p_event_id and rs.device_id = d.id and rs.status = 'needs_review'),
    eds.final_sequence, eds.reconciled_at,
    (select su.station_id from public.station_checkins sci join public.station_setups su on su.id = sci.station_setup_id
      where sci.device_access_id = dea.id and sci.checked_out_at is null limit 1),
    (select su.block_id from public.station_checkins sci join public.station_setups su on su.id = sci.station_setup_id
      where sci.device_access_id = dea.id and sci.checked_out_at is null limit 1)
  from public.device_event_access dea
  join public.devices d on d.id = dea.device_id
  left join public.event_device_states eds on eds.event_id = p_event_id and eds.device_id = d.id
  where dea.event_id = p_event_id
  order by dea.revoked_at is not null, dea.granted_at desc;
end;
$$;
revoke execute on function public.device_sync_overview(uuid) from public, anon;
grant execute on function public.device_sync_overview(uuid) to authenticated;

-- -------------------------------------------------------------------------
-- 8. Realtime für Check-ins, Gerätezustand und Zugang.
-- -------------------------------------------------------------------------
alter publication supabase_realtime add table public.station_checkins;
alter publication supabase_realtime add table public.event_device_states;
alter publication supabase_realtime add table public.device_event_access;

commit;
