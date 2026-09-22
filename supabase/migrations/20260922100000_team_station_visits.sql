begin;

-- =========================================================================
-- Gruppen-Check-in an der Station ("Laufzettel").
--
-- Die geplanten Uhrzeiten des Zeitplans sind am Veranstaltungstag nur eine
-- Absicht: ein Block startet gemeinsam, eine Runde endet aber erst, wenn das
-- letzte Spiel fertig ist. Dadurch verschieben sich Gruppen gegeneinander.
-- Diese Tabelle hält fest, wann eine Gruppe an einer Station tatsächlich
-- eingetroffen ist und wann sie weitergeschickt wurde. Daraus ergeben sich
-- Wartezeit an der Station, Wegzeit zwischen zwei Stationen (Overhead) und
-- der Verzug einer Gruppe gegenüber dem Plan.
--
-- Wie der Live-Zwischenstand ist das operative Telemetrie, kein Ergebnis:
-- last-write-wins über den vom Gerät gesendeten Zeitstempel, nie ein
-- Konflikt, nie Teil der revisionsbasierten Ergebnissicherung.
-- Siehe docs/datenkonzept.md Abschnitt 11.7.
-- =========================================================================

create table public.team_station_visits (
  participant_id uuid primary key,
  event_id uuid not null,
  match_id uuid not null,
  team_id uuid not null,
  arrived_at timestamptz,
  released_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by_device_id uuid,
  unique (event_id, participant_id),
  foreign key (event_id, participant_id) references public.match_participants(event_id, id) on delete cascade,
  foreign key (event_id, match_id) references public.matches(event_id, id) on delete cascade,
  foreign key (event_id, team_id) references public.teams(event_id, id) on delete cascade,
  foreign key (event_id) references public.events(id) on delete cascade,
  foreign key (updated_by_device_id) references public.devices(id) on delete set null,
  check (released_at is null or arrived_at is null or released_at >= arrived_at)
);
create index team_station_visits_event_idx on public.team_station_visits(event_id);
create index team_station_visits_match_idx on public.team_station_visits(event_id, match_id);
create index team_station_visits_team_idx on public.team_station_visits(event_id, team_id);

alter table public.team_station_visits enable row level security;

-- Lesen über den Eventzugriff (Organisatoren und Geräte), Schreiben nur über
-- die security-definer-Funktion sync_team_visit.
create policy team_station_visits_event_select on public.team_station_visits
  for select to authenticated using (private.has_event_access(event_id));

revoke all on public.team_station_visits from public, anon, authenticated;
grant select on public.team_station_visits to authenticated;

-- -------------------------------------------------------------------------
-- sync_team_visit: idempotenter Upsert einer Ankunft/Weiterschickung.
-- Last-write-wins über p_updated_at, damit mehrere Geräte derselben Station
-- ohne Konflikt auf denselben Stand kommen.
-- -------------------------------------------------------------------------
create or replace function public.sync_team_visit(
  p_event_id uuid,
  p_participant_id uuid,
  p_device_id uuid,
  p_device_access_id uuid,
  p_checkin_id uuid,
  p_arrived_at timestamptz default null,
  p_released_at timestamptz default null,
  p_updated_at timestamptz default null
)
returns public.team_station_visits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access public.device_event_access;
  v_participant public.match_participants%rowtype;
  v_match public.matches%rowtype;
  v_row public.team_station_visits;
  v_client_ts timestamptz := coalesce(p_updated_at, now());
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_released_at is not null and p_arrived_at is not null and p_released_at < p_arrived_at then
    raise exception 'release time is before arrival time';
  end if;

  select * into v_access from public.device_event_access dea
  where dea.id = p_device_access_id and dea.event_id = p_event_id
    and dea.device_id = p_device_id and dea.auth_user_id = (select auth.uid())
    and dea.revoked_at is null;
  if v_access.id is null then raise exception 'device access is not authorized for this event'; end if;

  select * into v_participant from public.match_participants mp
  where mp.id = p_participant_id and mp.event_id = p_event_id;
  if not found then raise exception 'match participant not found'; end if;

  select * into v_match from public.matches m
  where m.id = v_participant.match_id and m.event_id = p_event_id;
  if not found then raise exception 'match not found'; end if;

  if not exists (
    select 1 from public.station_checkins sci
    where sci.id = p_checkin_id and sci.event_id = p_event_id
      and sci.station_setup_id = v_match.station_setup_id
  ) then
    raise exception 'check-in does not match this station setup';
  end if;

  insert into public.team_station_visits (
    participant_id, event_id, match_id, team_id, arrived_at, released_at, updated_at, updated_by_device_id
  ) values (
    p_participant_id, p_event_id, v_participant.match_id, v_participant.team_id,
    p_arrived_at, p_released_at, v_client_ts, p_device_id
  )
  on conflict (participant_id) do update set
    arrived_at = case
      when excluded.updated_at >= public.team_station_visits.updated_at then excluded.arrived_at
      else public.team_station_visits.arrived_at
    end,
    released_at = case
      when excluded.updated_at >= public.team_station_visits.updated_at then excluded.released_at
      else public.team_station_visits.released_at
    end,
    updated_at = greatest(public.team_station_visits.updated_at, excluded.updated_at),
    updated_by_device_id = case
      when excluded.updated_at >= public.team_station_visits.updated_at then excluded.updated_by_device_id
      else public.team_station_visits.updated_by_device_id
    end
  returning * into v_row;

  return v_row;
end;
$$;
revoke execute on function public.sync_team_visit(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz) from public, anon;
grant execute on function public.sync_team_visit(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz) to authenticated;

-- -------------------------------------------------------------------------
-- Realtime für den Laufzettel.
-- -------------------------------------------------------------------------
alter publication supabase_realtime add table public.team_station_visits;

-- -------------------------------------------------------------------------
-- Offline-Paket um den Laufzettel und die tatsächlichen Match-Zeiten
-- ergänzen. Das Stationsgerät braucht beides, um die Zeitleiste auch ohne
-- Internet zu zeigen; ein neu beigetretenes Gerät übernimmt damit die bereits
-- erfassten Ankünfte der anderen Geräte derselben Station.
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
        'actual_started_at', m.actual_started_at, 'actual_ended_at', m.actual_ended_at,
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
    ), '[]'::jsonb),
    'team_visits', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participant_id', tv.participant_id, 'match_id', tv.match_id, 'team_id', tv.team_id,
        'arrived_at', tv.arrived_at, 'released_at', tv.released_at, 'updated_at', tv.updated_at
      ))
      from public.team_station_visits tv where tv.event_id = p_event_id
    ), '[]'::jsonb)
  );
$$;
revoke execute on function public.get_station_package(uuid) from public, anon;
grant execute on function public.get_station_package(uuid) to authenticated;

commit;
