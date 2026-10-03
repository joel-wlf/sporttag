begin;

-- =========================================================================
-- 1. Zeiteinstellungen für die Planungsmatrix
-- =========================================================================
alter table public.events
  add column schedule_start_time time not null default '09:00',
  add column round_minutes integer not null default 15 check (round_minutes between 1 and 600),
  add column changeover_minutes integer not null default 5 check (changeover_minutes between 0 and 600),
  add column break_minutes integer not null default 20 check (break_minutes between 1 and 600);

alter table public.rounds
  add column duration_minutes integer check (duration_minutes between 1 and 600);

-- =========================================================================
-- 2. Stationen dürfen ohne Standort angelegt werden (Spalte in der Matrix)
-- =========================================================================
alter table public.stations
  alter column latitude drop not null,
  alter column longitude drop not null;

alter table public.stations
  add constraint stations_coordinates_pair check ((latitude is null) = (longitude is null));

-- =========================================================================
-- 3. Zeit-Integritätsprüfungen erst beim Commit
-- =========================================================================
-- Die Matrix verschiebt viele Runden und Blöcke in einer Transaktion. Mit
-- sofortigen Triggern würden Zwischenzustände scheitern. Die Funktionen lesen
-- den aktuellen Zeilenstand neu, weil NEW bei verzögerter Ausführung veraltet
-- sein kann.
drop trigger blocks_guard_overlap on public.blocks;
drop trigger rounds_guard_bounds on public.rounds;

create or replace function private.guard_block_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_block public.blocks;
begin
  select * into v_block from public.blocks where id = new.id;
  if v_block.id is null then return null; end if;
  if exists (
    select 1 from public.blocks b
    where b.event_id = v_block.event_id and b.id <> v_block.id
      and (v_block.starts_at, v_block.ends_at) overlaps (b.starts_at, b.ends_at)
  ) then
    raise exception 'block overlaps an existing block in this event';
  end if;
  return null;
end;
$$;

create or replace function private.guard_round_bounds()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_round public.rounds;
declare v_block public.blocks;
begin
  select * into v_round from public.rounds where id = new.id;
  if v_round.id is null then return null; end if;
  select * into v_block from public.blocks where id = v_round.block_id and event_id = v_round.event_id;
  if v_block.id is null then raise exception 'block not found for round'; end if;
  if v_round.starts_at < v_block.starts_at or v_round.ends_at > v_block.ends_at then
    raise exception 'round is not within its block bounds';
  end if;
  if exists (
    select 1 from public.rounds r
    where r.block_id = v_round.block_id and r.id <> v_round.id
      and (v_round.starts_at, v_round.ends_at) overlaps (r.starts_at, r.ends_at)
  ) then
    raise exception 'round overlaps another round in the same block';
  end if;
  return null;
end;
$$;

create constraint trigger blocks_guard_overlap
  after insert or update of starts_at, ends_at on public.blocks
  deferrable initially deferred
  for each row execute function private.guard_block_overlap();

create constraint trigger rounds_guard_bounds
  after insert or update of starts_at, ends_at, block_id on public.rounds
  deferrable initially deferred
  for each row execute function private.guard_round_bounds();

-- =========================================================================
-- 4. Layout der Matrix anwenden
-- =========================================================================
-- p_rows: geordnete Liste [{round_id?, kind: 'play'|'break', duration_minutes?}]
-- p_settings: optional {schedule_start_time, round_minutes, changeover_minutes, break_minutes}
-- Aufeinanderfolgende Spielrunden bilden einen Block, jede Pause einen eigenen
-- Pausenblock. Vorhandene Runden behalten ihre ID und damit ihre Matches.
create function public.schedule_apply_layout(p_event_id uuid, p_rows jsonb, p_settings jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_row jsonb;
  v_idx integer := 0;
  v_count integer;
  v_kind text;
  v_prev_kind text := null;
  v_cursor timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_duration integer;
  v_round_id uuid;
  v_round public.rounds;
  v_segment integer := 0;
  v_block_id uuid;
  v_candidate uuid;
  v_seg record;
  v_match record;
  v_setup_id uuid;
  v_keep uuid[] := '{}';
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  perform private.guard_locked_after_publish(p_event_id);
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;

  if p_settings is not null then
    update public.events set
      schedule_start_time = coalesce((p_settings->>'schedule_start_time')::time, schedule_start_time),
      round_minutes = coalesce((p_settings->>'round_minutes')::integer, round_minutes),
      changeover_minutes = coalesce((p_settings->>'changeover_minutes')::integer, changeover_minutes),
      break_minutes = coalesce((p_settings->>'break_minutes')::integer, break_minutes)
    where id = p_event_id;
  end if;
  select * into v_event from public.events where id = p_event_id;

  -- Zeilen mit berechneten Zeiten und Segmenten vorbereiten.
  create temp table tmp_rows (
    idx integer primary key,
    round_id uuid,
    kind text not null,
    duration_minutes integer,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    segment integer not null,
    block_id uuid
  ) on commit drop;

  v_cursor := ((v_event.event_date + v_event.schedule_start_time)::timestamp) at time zone v_event.timezone;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    v_kind := v_row->>'kind';
    if v_kind not in ('play', 'break') then raise exception 'invalid row kind'; end if;
    v_round_id := nullif(v_row->>'round_id', '')::uuid;
    if v_round_id is not null and not exists (
      select 1 from public.rounds where id = v_round_id and event_id = p_event_id
    ) then
      raise exception 'round not found';
    end if;
    v_duration := nullif(v_row->>'duration_minutes', '')::integer;

    if v_prev_kind = 'play' and v_kind = 'play' then
      v_cursor := v_cursor + make_interval(mins => v_event.changeover_minutes);
    end if;
    if v_prev_kind is null or v_kind = 'break' or v_prev_kind = 'break' then
      v_segment := v_segment + 1;
    end if;

    v_start := v_cursor;
    v_end := v_start + make_interval(mins => coalesce(
      v_duration, case when v_kind = 'play' then v_event.round_minutes else v_event.break_minutes end));
    insert into tmp_rows values (v_idx, v_round_id, v_kind, v_duration, v_start, v_end, v_segment, null);
    v_cursor := v_end;
    v_prev_kind := v_kind;
  end loop;

  -- Entfernte Runden samt Matches löschen.
  delete from public.match_participants mp using public.matches m, public.rounds r
    where mp.match_id = m.id and m.round_id = r.id and r.event_id = p_event_id
      and r.id not in (select round_id from tmp_rows where round_id is not null);
  delete from public.matches m using public.rounds r
    where m.round_id = r.id and r.event_id = p_event_id
      and r.id not in (select round_id from tmp_rows where round_id is not null);
  delete from public.rounds
    where event_id = p_event_id
      and id not in (select round_id from tmp_rows where round_id is not null);

  -- Runden, die zur Pause werden, verlieren ihre Matches.
  delete from public.match_participants mp using public.matches m, tmp_rows t
    where mp.match_id = m.id and m.round_id = t.round_id and t.kind = 'break';
  delete from public.matches m using tmp_rows t
    where m.round_id = t.round_id and t.kind = 'break';

  -- Positionen freiräumen, damit die Eindeutigkeit beim Umsortieren hält.
  update public.blocks set position = position + 100000 where event_id = p_event_id;
  update public.rounds set position = position + 100000 where event_id = p_event_id;

  -- Jedem Segment einen Block zuordnen (vorhandenen wiederverwenden, sonst neu).
  for v_seg in
    select segment, min(kind) as kind, min(starts_at) as starts_at, max(ends_at) as ends_at
    from tmp_rows group by segment order by segment
  loop
    select r.block_id into v_candidate
    from tmp_rows t join public.rounds r on r.id = t.round_id
    join public.blocks b on b.id = r.block_id
    where t.segment = v_seg.segment
      and (b.kind = 'break') = (v_seg.kind = 'break')
      and not (r.block_id = any(v_keep))
    group by r.block_id
    order by count(*) desc, min(t.idx)
    limit 1;

    if v_candidate is null then
      insert into public.blocks (event_id, kind, position, starts_at, ends_at)
      values (p_event_id, v_seg.kind, v_seg.segment, v_seg.starts_at, v_seg.ends_at)
      returning id into v_block_id;
    else
      v_block_id := v_candidate;
      update public.blocks set
        kind = v_seg.kind, position = v_seg.segment, starts_at = v_seg.starts_at, ends_at = v_seg.ends_at
      where id = v_block_id;
    end if;
    v_keep := v_keep || v_block_id;
    update tmp_rows set block_id = v_block_id where segment = v_seg.segment;

    -- Spielblock: Stationsbelegungen der bisherigen Blöcke dieser Runden übernehmen.
    if v_seg.kind = 'play' then
      insert into public.station_setups (event_id, block_id, station_id, event_game_id, notes)
      select distinct on (ss.station_id) p_event_id, v_block_id, ss.station_id, ss.event_game_id, ss.notes
      from tmp_rows t
      join public.rounds r on r.id = t.round_id
      join public.station_setups ss on ss.block_id = r.block_id
      where t.segment = v_seg.segment and r.block_id <> v_block_id
        and not exists (
          select 1 from public.station_setups x where x.block_id = v_block_id and x.station_id = ss.station_id
        )
      order by ss.station_id, t.idx;
    end if;
  end loop;

  -- Runden anlegen oder aktualisieren.
  v_count := 0;
  for v_seg in select * from tmp_rows order by idx loop
    select count(*) + 1 into v_count from tmp_rows
      where segment = v_seg.segment and idx < v_seg.idx;
    if v_seg.round_id is null then
      insert into public.rounds (event_id, block_id, position, kind, starts_at, ends_at, duration_minutes)
      values (p_event_id, v_seg.block_id, v_count, v_seg.kind, v_seg.starts_at, v_seg.ends_at, v_seg.duration_minutes);
    else
      update public.rounds set
        block_id = v_seg.block_id, position = v_count, kind = v_seg.kind,
        starts_at = v_seg.starts_at, ends_at = v_seg.ends_at, duration_minutes = v_seg.duration_minutes
      where id = v_seg.round_id;
    end if;
  end loop;

  -- Matches auf die Belegung derselben Station im neuen Block umhängen.
  for v_match in
    select m.id, r.block_id as new_block_id, ss.station_id, ss.event_game_id
    from public.matches m
    join public.rounds r on r.id = m.round_id
    join public.station_setups ss on ss.id = m.station_setup_id
    where m.event_id = p_event_id and ss.block_id <> r.block_id
  loop
    select id into v_setup_id from public.station_setups
      where block_id = v_match.new_block_id and station_id = v_match.station_id;
    if v_setup_id is null then
      insert into public.station_setups (event_id, block_id, station_id, event_game_id)
      values (p_event_id, v_match.new_block_id, v_match.station_id, v_match.event_game_id)
      returning id into v_setup_id;
    end if;
    update public.matches set station_setup_id = v_setup_id where id = v_match.id;
  end loop;

  -- Nicht mehr genutzte Blöcke und Belegungen aufräumen.
  delete from public.station_assignments sa using public.station_setups ss
    where sa.station_setup_id = ss.id and ss.event_id = p_event_id
      and (not (ss.block_id = any(v_keep))
        or ss.block_id in (select id from public.blocks where event_id = p_event_id and kind = 'break'));
  delete from public.station_setups ss
    where ss.event_id = p_event_id
      and (not (ss.block_id = any(v_keep))
        or ss.block_id in (select id from public.blocks where event_id = p_event_id and kind = 'break'));
  delete from public.blocks where event_id = p_event_id and not (id = any(v_keep));
end;
$$;
revoke execute on function public.schedule_apply_layout(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_apply_layout(uuid, jsonb, jsonb) to authenticated;

-- =========================================================================
-- 5. Spiel einer Station in einem Block setzen
-- =========================================================================
create function public.schedule_set_block_game(p_block_id uuid, p_station_id uuid, p_event_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block public.blocks;
  v_setup public.station_setups;
  v_game public.event_games;
begin
  select * into v_block from public.blocks where id = p_block_id;
  if v_block.id is null then raise exception 'block not found'; end if;
  if not private.is_event_organizer(v_block.event_id) then
    raise exception 'organizer membership required';
  end if;
  perform private.guard_locked_after_publish(v_block.event_id);
  if v_block.kind = 'break' then raise exception 'break blocks have no games'; end if;

  select * into v_setup from public.station_setups where block_id = p_block_id and station_id = p_station_id;

  if p_event_game_id is null then
    if v_setup.id is null then return; end if;
    if exists (select 1 from public.matches where station_setup_id = v_setup.id and status <> 'cancelled') then
      raise exception 'station setup still has matches';
    end if;
    delete from public.station_assignments where station_setup_id = v_setup.id;
    delete from public.station_setups where id = v_setup.id;
    return;
  end if;

  select * into v_game from public.event_games where id = p_event_game_id and event_id = v_block.event_id;
  if v_game.id is null then raise exception 'game not found'; end if;

  if v_setup.id is null then
    insert into public.station_setups (event_id, block_id, station_id, event_game_id)
    values (v_block.event_id, p_block_id, p_station_id, p_event_game_id);
  else
    if exists (
      select 1 from public.matches m
      where m.station_setup_id = v_setup.id and m.status <> 'cancelled'
        and (select count(*) from public.match_participants mp where mp.match_id = m.id) > v_game.max_teams
    ) then
      raise exception 'existing matches have more teams than the game allows';
    end if;
    update public.station_setups set event_game_id = p_event_game_id where id = v_setup.id;
  end if;
end;
$$;
revoke execute on function public.schedule_set_block_game(uuid, uuid, uuid) from public, anon;
grant execute on function public.schedule_set_block_game(uuid, uuid, uuid) to authenticated;

-- =========================================================================
-- 6. Zellen der Matrix (Teams je Runde und Station) setzen
-- =========================================================================
-- p_cells: [{round_id, station_id, team_ids: [uuid]}]; leere team_ids leeren die Zelle.
create function public.schedule_set_cells(p_event_id uuid, p_cells jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cell jsonb;
  v_round public.rounds;
  v_setup public.station_setups;
  v_game public.event_games;
  v_match_id uuid;
  v_team_ids uuid[];
  v_team uuid;
  v_slot integer;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  perform private.guard_locked_after_publish(p_event_id);
  if jsonb_typeof(p_cells) <> 'array' then raise exception 'cells must be an array'; end if;

  -- Durchgang 1: bestehende Belegungen der betroffenen Zellen leeren.
  for v_cell in select * from jsonb_array_elements(p_cells) loop
    select m.id into v_match_id
    from public.matches m
    join public.station_setups ss on ss.id = m.station_setup_id
    where m.round_id = (v_cell->>'round_id')::uuid
      and ss.station_id = (v_cell->>'station_id')::uuid
      and m.event_id = p_event_id and m.status <> 'cancelled';
    if v_match_id is not null then
      delete from public.match_participants where match_id = v_match_id;
      if jsonb_array_length(coalesce(v_cell->'team_ids', '[]'::jsonb)) = 0 then
        delete from public.matches where id = v_match_id;
      end if;
    end if;
  end loop;

  -- Durchgang 2: neue Belegungen schreiben.
  for v_cell in select * from jsonb_array_elements(p_cells) loop
    select array_agg(value::uuid) into v_team_ids
      from jsonb_array_elements_text(coalesce(v_cell->'team_ids', '[]'::jsonb));
    if v_team_ids is null or array_length(v_team_ids, 1) is null then continue; end if;

    select * into v_round from public.rounds
      where id = (v_cell->>'round_id')::uuid and event_id = p_event_id;
    if v_round.id is null then raise exception 'round not found'; end if;
    if v_round.kind <> 'play' then raise exception 'matches cannot be scheduled in a break round'; end if;

    select * into v_setup from public.station_setups
      where block_id = v_round.block_id and station_id = (v_cell->>'station_id')::uuid;
    if v_setup.id is null then raise exception 'station has no game in this block'; end if;

    select * into v_game from public.event_games where id = v_setup.event_game_id;
    if array_length(v_team_ids, 1) > v_game.max_teams then
      raise exception 'too many teams for this game';
    end if;

    select id into v_match_id from public.matches
      where round_id = v_round.id and station_setup_id = v_setup.id and status <> 'cancelled';
    if v_match_id is null then
      insert into public.matches (event_id, round_id, station_setup_id)
      values (p_event_id, v_round.id, v_setup.id)
      returning id into v_match_id;
    end if;

    v_slot := 0;
    foreach v_team in array v_team_ids loop
      v_slot := v_slot + 1;
      if not exists (select 1 from public.teams where id = v_team and event_id = p_event_id) then
        raise exception 'team not found';
      end if;
      insert into public.match_participants (event_id, match_id, team_id, slot)
      values (p_event_id, v_match_id, v_team, v_slot);
    end loop;
  end loop;
end;
$$;
revoke execute on function public.schedule_set_cells(uuid, jsonb) from public, anon;
grant execute on function public.schedule_set_cells(uuid, jsonb) to authenticated;

-- =========================================================================
-- 7. Bereitschaftsprüfung: Stationen ohne Standort
-- =========================================================================
create or replace function public.check_event_readiness(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_issues jsonb := '[]'::jsonb;
declare v_event public.events;
begin
  if not private.has_event_access(p_event_id) then
    raise exception 'event access required';
  end if;
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null then raise exception 'event not found'; end if;

  if v_event.default_scoring_rule_id is null then
    v_issues := v_issues || jsonb_build_object(
      'code', 'missing_default_scoring_rule', 'severity', 'error',
      'message', 'Es ist keine Standard-Wertungsregel gesetzt.');
  end if;

  if (select count(*) from public.teams where event_id = p_event_id) < 2 then
    v_issues := v_issues || jsonb_build_object(
      'code', 'not_enough_teams', 'severity', 'error',
      'message', 'Es sind weniger als zwei Teams angelegt.');
  end if;

  if not exists (select 1 from public.stations where event_id = p_event_id) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'no_stations', 'severity', 'error',
      'message', 'Es ist keine Station angelegt.');
  end if;

  if not exists (
    select 1 from public.rounds r where r.event_id = p_event_id and r.kind = 'play'
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'no_play_rounds', 'severity', 'error',
      'message', 'Es ist keine Spielrunde angelegt.');
  end if;

  -- Spielrunden ohne Match
  if exists (
    select 1 from public.rounds r
    where r.event_id = p_event_id and r.kind = 'play'
      and not exists (
        select 1 from public.matches m
        where m.round_id = r.id and m.status <> 'cancelled'
      )
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'rounds_without_matches', 'severity', 'warning',
      'message', 'Mindestens eine Spielrunde hat kein Match.');
  end if;

  -- win_draw_loss auf Mehrteammatch
  if exists (
    select 1 from public.matches m
    join public.event_games g on g.event_id = m.event_id and g.id = (
      select ss.event_game_id from public.station_setups ss where ss.id = m.station_setup_id
    )
    join public.scoring_rules sr on sr.event_id = m.event_id
      and sr.id = coalesce(m.scoring_rule_id, g.scoring_rule_id, v_event.default_scoring_rule_id)
    where m.event_id = p_event_id and m.status <> 'cancelled' and sr.mode = 'win_draw_loss'
      and (select count(*) from public.match_participants mp where mp.match_id = m.id) > 2
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'win_draw_loss_multi_team', 'severity', 'error',
      'message', 'Ein Mehrteamspiel verwendet die Zweier-Wertungsregel Sieg/Unentschieden/Niederlage.');
  end if;

  -- Teilnehmerzahl außerhalb min/max
  if exists (
    select 1 from public.matches m
    join public.event_games g on g.event_id = m.event_id and g.id = (
      select ss.event_game_id from public.station_setups ss where ss.id = m.station_setup_id
    )
    where m.event_id = p_event_id and m.status <> 'cancelled'
      and (select count(*) from public.match_participants mp where mp.match_id = m.id)
        not between g.min_teams and g.max_teams
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'participant_count_mismatch', 'severity', 'error',
      'message', 'Ein Match hat eine unzulässige Teilnehmerzahl für sein Spiel.');
  end if;

  -- Team doppelt in einer Runde
  if exists (
    select 1 from (
      select m.round_id, mp.team_id, count(*) as c
      from public.match_participants mp
      join public.matches m on m.id = mp.match_id and m.status <> 'cancelled'
      where m.event_id = p_event_id
      group by m.round_id, mp.team_id
    ) dup where dup.c > 1
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'team_double_booked', 'severity', 'error',
      'message', 'Ein Team ist in einer Runde mehrfach eingeplant.');
  end if;

  -- Belegungen ohne Betreuung
  if exists (
    select 1 from public.station_setups ss
    where ss.event_id = p_event_id
      and not exists (
        select 1 from public.station_assignments sa where sa.station_setup_id = ss.id
      )
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'unstaffed_setup', 'severity', 'warning',
      'message', 'Mindestens eine Stationsbelegung hat keine Betreuung.');
  end if;

  if exists (select 1 from public.stations where event_id = p_event_id and latitude is null) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'station_without_location', 'severity', 'warning',
      'message', 'Mindestens eine Station hat noch keinen Standort auf der Karte.');
  end if;

  if v_event.active_map_id is null then
    v_issues := v_issues || jsonb_build_object(
      'code', 'no_active_map', 'severity', 'warning',
      'message', 'Es ist noch keine Offline-Karte hinterlegt.');
  end if;

  return v_issues;
end;
$$;
revoke execute on function public.check_event_readiness(uuid) from public, anon;
grant execute on function public.check_event_readiness(uuid) to authenticated;

commit;
