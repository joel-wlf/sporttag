begin;

-- =========================================================================
-- Spieler je Team (Planungsschritt "Teams").
--
-- `players` hält nur Name und Teamzugehörigkeit; Stationsgeräte mit
-- Eventzugang dürfen sie lesen (versteckte Namensliste für Anwesenheit).
-- `player_attributes` hält Geschlecht, Stärke, Alter und Notiz und ist
-- ausschließlich für Organisatoren sichtbar. Die Trennung in zwei Tabellen
-- ist nötig, weil Spaltenrechte nicht zwischen Organisatoren und anonymen
-- Gerätesitzungen (beide Rolle `authenticated`) unterscheiden.
--
-- Bewusst KEIN bump_plan_version: submit_result wertet eine abweichende
-- Planversion als Konflikt. Eine Umbesetzung am Sporttag soll keine
-- Ergebnisabgaben in Klärung schicken. Geräte laden das Paket ohnehin bei
-- jedem Sync neu (StationSessionProvider.refreshPackage).
-- =========================================================================

create table public.players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid,
  name text not null check (length(trim(name)) > 0),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, team_id) references public.teams(event_id, id) on delete set null (team_id)
);
create index players_event_team_idx on public.players (event_id, team_id);

create table public.player_attributes (
  player_id uuid primary key,
  event_id uuid not null,
  gender text check (gender in ('f', 'm', 'd')),
  skill smallint check (skill between 1 and 6),  -- 1 = schwach … 6 = sehr stark
  age smallint check (age between 1 and 120),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, player_id) references public.players(event_id, id) on delete cascade
);
create index player_attributes_event_idx on public.player_attributes (event_id);

create trigger players_updated_at before update on public.players
  for each row execute function public.set_updated_at();
create trigger player_attributes_updated_at before update on public.player_attributes
  for each row execute function public.set_updated_at();

alter table public.players enable row level security;
alter table public.player_attributes enable row level security;
revoke all on table public.players, public.player_attributes from anon, authenticated;
grant select, insert, update, delete on public.players, public.player_attributes to authenticated;

create policy players_event_select on public.players for select to authenticated
  using (private.has_event_access(event_id));
create policy players_organizer_insert on public.players for insert to authenticated
  with check (private.is_event_organizer(event_id));
create policy players_organizer_update on public.players for update to authenticated
  using (private.is_event_organizer(event_id)) with check (private.is_event_organizer(event_id));
create policy players_organizer_delete on public.players for delete to authenticated
  using (private.is_event_organizer(event_id));

create policy player_attributes_organizer_select on public.player_attributes for select to authenticated
  using (private.is_event_organizer(event_id));
create policy player_attributes_organizer_insert on public.player_attributes for insert to authenticated
  with check (private.is_event_organizer(event_id));
create policy player_attributes_organizer_update on public.player_attributes for update to authenticated
  using (private.is_event_organizer(event_id)) with check (private.is_event_organizer(event_id));
create policy player_attributes_organizer_delete on public.player_attributes for delete to authenticated
  using (private.is_event_organizer(event_id));

-- Mehrere Zuordnungen (automatische Verteilung, Zurücksetzen) atomar setzen.
create or replace function public.set_player_teams(p_event_id uuid, p_assignments jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_expected integer;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'assignments must be an array' using errcode = '22023';
  end if;

  v_expected := jsonb_array_length(p_assignments);

  if exists (
    select 1 from jsonb_array_elements(p_assignments) a
    where nullif(a->>'team_id', '') is not null
      and not exists (
        select 1 from public.teams t
        where t.event_id = p_event_id and t.id = (a->>'team_id')::uuid
      )
  ) then
    raise exception 'team not in event' using errcode = '23503';
  end if;

  update public.players p
    set team_id = nullif(a->>'team_id', '')::uuid,
        locked = coalesce((a->>'locked')::boolean, p.locked)
  from jsonb_array_elements(p_assignments) a
  where p.event_id = p_event_id and p.id = (a->>'player_id')::uuid;
  get diagnostics v_count = row_count;

  if v_count <> v_expected then
    raise exception 'player not in event' using errcode = '23503';
  end if;
  return v_count;
end;
$$;
revoke execute on function public.set_player_teams(uuid, jsonb) from public, anon;
grant execute on function public.set_player_teams(uuid, jsonb) to authenticated;

-- Offline-Paket: nur Namen und Teamzugehörigkeit, keine Attribute.
create or replace function public.get_station_package(p_event_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select jsonb_build_object(
    'server_time', now(),
    'event', (
      select jsonb_build_object(
        'id', e.id, 'name', e.name, 'motto', e.motto, 'event_date', e.event_date,
        'timezone', e.timezone, 'status', e.status, 'plan_version', e.plan_version,
        'staff_assignment_mode', e.staff_assignment_mode,
        'venue_north', e.venue_north, 'venue_south', e.venue_south,
        'venue_east', e.venue_east, 'venue_west', e.venue_west,
        'assistance_phone', e.assistance_phone, 'medical_phone', e.medical_phone
      )
      from public.events e where e.id = p_event_id
    ),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'number', t.number, 'color', t.color
      ) order by t.number nulls last, t.name)
      from public.teams t where t.event_id = p_event_id
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pl.id, 'team_id', pl.team_id, 'name', pl.name
      ) order by pl.name)
      from public.players pl where pl.event_id = p_event_id and pl.team_id is not null
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
$function$;

commit;
