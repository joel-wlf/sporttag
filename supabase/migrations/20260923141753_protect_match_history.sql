begin;

-- =========================================================================
-- Ergebnis-Historie beim Umplanen schützen.
--
-- Seit veröffentlichte Events bearbeitbar sind (20260923104419), erreichte
-- das Backoffice Löschpfade, die über ON DELETE CASCADE Ergebnisse
-- mitnahmen: Zelle leeren oder Runde löschen löschte das Match samt
-- result_submissions/result_revisions; schon das erneute Speichern einer
-- Zelle legte die Teilnehmer neu an und löschte dabei result_values und den
-- Laufzettel. Ebenso Station, Spiel, Block oder Team löschen.
--
-- docs/datenkonzept.md 7: Ein abgeschlossenes Match wird nicht still
-- überschrieben; Neuplanung und Ergebnisrückzug sind eigene, protokollierte
-- Vorgänge. Ein Match mit Historie wird deshalb nicht mehr gelöscht und
-- seine Teilnehmer nicht mehr ersetzt – stattdessen absagen (Live-Betrieb)
-- und bei Bedarf ein neues Match planen.
--
-- Ausnahme: Wird die ganze Veranstaltung gelöscht (delete_event,
-- delete_draft_event), ist die Event-Zeile im Kaskadenlauf schon weg; dann
-- greift der Schutz nicht.
-- =========================================================================

create or replace function private.match_has_history(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.result_submissions s where s.match_id = p_match_id)
      or exists (select 1 from public.result_revisions r where r.match_id = p_match_id)
      or exists (select 1 from public.team_station_visits v where v.match_id = p_match_id);
$$;

create or replace function private.guard_match_history_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.events e where e.id = old.event_id) then
    return old; -- ganze Veranstaltung wird gelöscht
  end if;
  if private.match_has_history(old.id) then
    raise exception 'match_has_results'
      using detail = 'Match ' || old.id || ' hat Abgaben, Revisionen oder einen Laufzettel.';
  end if;
  return old;
end;
$$;

create or replace function private.guard_participant_history_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.events e where e.id = old.event_id) then
    return old;
  end if;
  if exists (select 1 from public.result_values rv where rv.participant_id = old.id)
     or exists (select 1 from public.team_station_visits v where v.participant_id = old.id) then
    raise exception 'match_has_results'
      using detail = 'Teilnahme ' || old.id || ' hat Ergebniswerte oder einen Laufzettel.';
  end if;
  return old;
end;
$$;

drop trigger if exists matches_guard_history_delete on public.matches;
create trigger matches_guard_history_delete
  before delete on public.matches
  for each row execute function private.guard_match_history_delete();

drop trigger if exists match_participants_guard_history_delete on public.match_participants;
create trigger match_participants_guard_history_delete
  before delete on public.match_participants
  for each row execute function private.guard_participant_history_delete();

-- -------------------------------------------------------------------------
-- schedule_set_cells: unveränderte Zellen nicht mehr anfassen. Bisher wurden
-- die Teilnehmer bei jedem Speichern gelöscht und neu angelegt (neue IDs);
-- mit dem Schutz oben würde das jedes gespeicherte Match mit Ergebnis
-- blockieren. Sonst unverändert gegenüber der bisherigen Fassung.
-- -------------------------------------------------------------------------
create or replace function public.schedule_set_cells(p_event_id uuid, p_cells jsonb)
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
  v_current uuid[];
  v_team uuid;
  v_slot integer;
  v_unchanged text[] := '{}';
  v_key text;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  perform private.guard_locked_after_publish(p_event_id);
  if jsonb_typeof(p_cells) <> 'array' then raise exception 'cells must be an array'; end if;

  for v_cell in select * from jsonb_array_elements(p_cells) loop
    v_key := (v_cell->>'round_id') || ':' || (v_cell->>'station_id');
    select coalesce(array_agg(value::uuid), '{}') into v_team_ids
      from jsonb_array_elements_text(coalesce(v_cell->'team_ids', '[]'::jsonb));

    select m.id into v_match_id
    from public.matches m
    join public.station_setups ss on ss.id = m.station_setup_id
    where m.round_id = (v_cell->>'round_id')::uuid
      and ss.station_id = (v_cell->>'station_id')::uuid
      and m.event_id = p_event_id and m.status <> 'cancelled';
    if v_match_id is not null then
      select coalesce(array_agg(mp.team_id order by mp.slot), '{}') into v_current
        from public.match_participants mp where mp.match_id = v_match_id;
      if v_current = v_team_ids then
        v_unchanged := v_unchanged || v_key;
        continue;
      end if;
      -- Die Trigger oben lehnen das mit `match_has_results` ab, wenn das
      -- Match schon Historie hat.
      delete from public.match_participants where match_id = v_match_id;
      if array_length(v_team_ids, 1) is null then
        delete from public.matches where id = v_match_id;
      end if;
    end if;
  end loop;

  for v_cell in select * from jsonb_array_elements(p_cells) loop
    v_key := (v_cell->>'round_id') || ':' || (v_cell->>'station_id');
    if v_key = any (v_unchanged) then continue; end if;

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

revoke execute on function private.match_has_history(uuid) from public, anon, authenticated;

commit;
