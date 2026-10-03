begin;

-- =========================================================================
-- Hilfe-Rufnummern je Veranstaltung.
--
-- Die Hilfeaktionen "Assistenz" und "Medizinisch" der Stations-App riefen
-- bisher Nummern aus EXPO_PUBLIC_*-Umgebungsvariablen an: eine Nummer pro
-- App-Build statt pro Veranstaltung, änderbar nur durch einen neuen Build.
-- Jetzt pflegen Organisatoren sie in den Event-Einstellungen; sie reisen im
-- Offline-Paket mit und funktionieren damit auch ohne Netz.
-- =========================================================================

alter table public.events
  add column assistance_phone text,
  add column medical_phone text,
  add constraint events_assistance_phone_format
    check (assistance_phone is null or assistance_phone ~ '^\+?[0-9 ()/-]{3,30}$'),
  add constraint events_medical_phone_format
    check (medical_phone is null or medical_phone ~ '^\+?[0-9 ()/-]{3,30}$');

comment on column public.events.assistance_phone is
  'Rufnummer für die Hilfeaktion "Assistenz" der Stations-App (Orga/Leitstelle).';
comment on column public.events.medical_phone is
  'Rufnummer für die Hilfeaktion "Medizinisch" der Stations-App (Sanitätsdienst).';

-- Offline-Paket: beide Nummern im Event-Objekt ausliefern.
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
