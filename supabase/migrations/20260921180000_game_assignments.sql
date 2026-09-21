begin;

-- Betreuung kann pro Sporttag entweder Stationen oder Spielen zugeordnet werden.
alter table public.events
  add column staff_assignment_mode text not null default 'station'
    check (staff_assignment_mode in ('station', 'game'));

create table public.game_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  staff_id uuid not null,
  event_game_id uuid not null,
  created_at timestamptz not null default now(),
  unique (event_id, id),
  unique (staff_id, event_game_id),
  foreign key (event_id, staff_id) references public.event_staff(event_id, id) on delete restrict,
  foreign key (event_id, event_game_id) references public.event_games(event_id, id) on delete restrict
);

create index game_assignments_event_staff_idx on public.game_assignments(event_id, staff_id);
create index game_assignments_event_game_idx on public.game_assignments(event_id, event_game_id);

alter table public.game_assignments enable row level security;
revoke all on table public.game_assignments from anon, authenticated;

grant select on public.game_assignments to authenticated;
grant insert, update, delete on public.game_assignments to authenticated;

create policy game_assignments_event_select on public.game_assignments for select to authenticated
  using (private.has_event_access(event_id));
create policy game_assignments_organizer_insert on public.game_assignments for insert to authenticated
  with check (private.is_event_organizer(event_id));
create policy game_assignments_organizer_update on public.game_assignments for update to authenticated
  using (private.is_event_organizer(event_id)) with check (private.is_event_organizer(event_id));
create policy game_assignments_organizer_delete on public.game_assignments for delete to authenticated
  using (private.is_event_organizer(event_id));

-- Belegungen/Spiele ohne Betreuung: je nach Zuordnungsmodus des Events prüfen wir
-- entweder Stationsbelegungen (station_assignments) oder Spiele (game_assignments).
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

  -- Belegungen/Spiele ohne Betreuung (je nach Zuordnungsmodus)
  if v_event.staff_assignment_mode = 'game' then
    if exists (
      select 1 from public.station_setups ss
      where ss.event_id = p_event_id
        and not exists (
          select 1 from public.game_assignments ga
          where ga.event_id = ss.event_id and ga.event_game_id = ss.event_game_id
        )
    ) then
      v_issues := v_issues || jsonb_build_object(
        'code', 'unstaffed_game', 'severity', 'warning',
        'message', 'Mindestens ein eingeplantes Spiel hat keine Betreuung.');
    end if;
  else
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

create or replace function public.delete_draft_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  select status into v_status from public.events where id = p_event_id;
  if v_status is null then raise exception 'event not found'; end if;
  if v_status <> 'draft' then
    raise exception 'only draft events can be deleted';
  end if;
  if exists (select 1 from public.result_submissions where event_id = p_event_id) then
    raise exception 'event has result submissions and cannot be deleted';
  end if;

  delete from public.checkin_staff where event_id = p_event_id;
  delete from public.station_checkins where event_id = p_event_id;
  delete from public.device_event_access where event_id = p_event_id;
  delete from public.event_access_codes where event_id = p_event_id;
  delete from public.result_values where event_id = p_event_id;
  delete from public.result_revisions where event_id = p_event_id;
  delete from public.match_participants where event_id = p_event_id;
  delete from public.matches where event_id = p_event_id;
  delete from public.game_assignments where event_id = p_event_id;
  delete from public.station_assignments where event_id = p_event_id;
  delete from public.station_setups where event_id = p_event_id;
  delete from public.event_staff where event_id = p_event_id;
  delete from public.rounds where event_id = p_event_id;
  delete from public.blocks where event_id = p_event_id;
  delete from public.event_device_states where event_id = p_event_id;
  delete from public.event_games where event_id = p_event_id;
  delete from public.teams where event_id = p_event_id;
  delete from public.stations where event_id = p_event_id;
  update public.events set active_map_id = null, default_scoring_rule_id = null where id = p_event_id;
  delete from public.event_maps where event_id = p_event_id;
  delete from public.scoring_rules where event_id = p_event_id;
  delete from public.event_memberships where event_id = p_event_id;
  delete from public.events where id = p_event_id;
end;
$$;
revoke execute on function public.delete_draft_event(uuid) from public, anon;
grant execute on function public.delete_draft_event(uuid) to authenticated;

commit;
