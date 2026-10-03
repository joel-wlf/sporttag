begin;

-- =========================================================================
-- Live-Zwischenstand: Zähler je Team zusammenführen.
--
-- Bisher ersetzte jede Meldung den ganzen Stand, sobald ihr Zeitstempel
-- neuer war. Zählen zwei Geräte verschiedene Teams (oder ein Gerät offline),
-- ging dadurch der Zählstand des anderen Teams verloren; zusätzlich konnte
-- eine vorgehende Geräteuhr alle späteren Meldungen dauerhaft verdrängen.
--
-- Einträge mit `rev` (Zählerspiele, `measurement_type = 'number'`) werden
-- jetzt je Team zusammengeführt: die höhere Version gewinnt, bei gleicher
-- Version das Gerät (`by`, Codepunkt-Vergleich), danach der höhere Wert. Die
-- Regel steht identisch in lib/station/liveMerge.ts. Meldungen ohne `rev`
-- (Ausgang, Platzierungen) bleiben Gesamtmomentaufnahmen mit "zuletzt
-- geschrieben gewinnt". Ältere App-Versionen senden kein `rev` und bleiben
-- unverändert nutzbar.
--
-- Gerätezeitstempel werden auf die Serverzeit begrenzt: eine falsch
-- vorgehende Uhr gewinnt nicht mehr dauerhaft.
-- Siehe docs/datenkonzept.md Abschnitt 11.6.
-- =========================================================================

create or replace function public.sync_match_live(
  p_event_id uuid,
  p_match_id uuid,
  p_device_id uuid,
  p_device_access_id uuid,
  p_checkin_id uuid,
  p_values jsonb,
  p_started boolean,
  p_updated_at timestamptz
)
returns public.match_live_states
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access public.device_event_access;
  v_match public.matches%rowtype;
  v_row public.match_live_states;
  v_existing public.match_live_states;
  v_client_ts timestamptz := least(coalesce(p_updated_at, now()), now());
  v_counter boolean;
  v_incoming jsonb;
  v_merged jsonb;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'array' then
    raise exception 'invalid live values';
  end if;

  select * into v_access from public.device_event_access dea
  where dea.id = p_device_access_id and dea.event_id = p_event_id
    and dea.device_id = p_device_id and dea.auth_user_id = (select auth.uid())
    and dea.revoked_at is null;
  if v_access.id is null then raise exception 'device access is not authorized for this event'; end if;

  select * into v_match from public.matches m
  where m.id = p_match_id and m.event_id = p_event_id for update;
  if not found then raise exception 'match not found'; end if;

  -- Der Check-in muss zum selben physischen Gerät gehören (über device_id,
  -- nicht device_access_id). Verhindert, dass ein fremdes Gerät eine
  -- ausgelesene checkin_id einer anderen Station nutzt.
  if not exists (
    select 1 from public.station_checkins sci
    join public.device_event_access dea2 on dea2.id = sci.device_access_id
    where sci.id = p_checkin_id and sci.event_id = p_event_id
      and sci.station_setup_id = v_match.station_setup_id
      and dea2.device_id = p_device_id
  ) then
    raise exception 'check-in does not match this station setup';
  end if;

  -- Match als laufend markieren, solange es noch nicht begonnen hat. Ein
  -- bereits abgeschlossenes oder abgesagtes Match wird nie reaktiviert.
  if p_started and v_match.status in ('scheduled', 'ready') then
    update public.matches
      set status = 'in_progress',
          actual_started_at = coalesce(actual_started_at, v_client_ts),
          updated_at = now()
    where id = p_match_id;
  end if;

  v_counter := exists (
    select 1 from jsonb_array_elements(p_values) e where jsonb_typeof(e->'rev') = 'number'
  );

  if v_counter then
    -- Nur Einträge für Teilnehmende dieses Matches; `by` ergänzen, wo es fehlt.
    if exists (
      select 1 from jsonb_array_elements(p_values) e
      where jsonb_typeof(e) <> 'object'
        or not exists (
          select 1 from public.match_participants mp
          where mp.match_id = p_match_id and mp.id::text = e->>'participant_id'
        )
    ) then
      raise exception 'invalid live values';
    end if;

    select coalesce(jsonb_agg(
      case when e ? 'by' then e else e || jsonb_build_object('by', p_device_id::text) end
    ), '[]'::jsonb) into v_incoming
    from jsonb_array_elements(p_values) e;

    select * into v_existing from public.match_live_states where match_id = p_match_id;

    select coalesce(jsonb_agg(x.elem order by x.pid collate "C"), '[]'::jsonb) into v_merged
    from (
      select distinct on (u.pid) u.pid, u.elem
      from (
        select e->>'participant_id' as pid, e as elem
        from jsonb_array_elements(coalesce(v_existing.values, '[]'::jsonb)) e
        union all
        select e->>'participant_id', e
        from jsonb_array_elements(v_incoming) e
      ) u
      order by u.pid,
        coalesce((u.elem->>'rev')::int, 0) desc,
        coalesce(u.elem->>'by', '') collate "C" desc,
        (u.elem->>'measured_value')::numeric desc nulls last
    ) x;

    insert into public.match_live_states (
      match_id, event_id, values, started_at, updated_at, updated_by_device_id
    ) values (
      p_match_id, p_event_id, v_merged,
      case when p_started then v_client_ts else null end,
      v_client_ts, p_device_id
    )
    on conflict (match_id) do update set
      values = excluded.values,
      started_at = coalesce(public.match_live_states.started_at, excluded.started_at),
      updated_at = greatest(public.match_live_states.updated_at, excluded.updated_at),
      updated_by_device_id = excluded.updated_by_device_id
    returning * into v_row;

    return v_row;
  end if;

  insert into public.match_live_states (
    match_id, event_id, values, started_at, updated_at, updated_by_device_id
  ) values (
    p_match_id, p_event_id, p_values,
    case when p_started then v_client_ts else null end,
    v_client_ts, p_device_id
  )
  on conflict (match_id) do update set
    values = case
      when excluded.updated_at >= public.match_live_states.updated_at then excluded.values
      else public.match_live_states.values
    end,
    started_at = coalesce(public.match_live_states.started_at, excluded.started_at),
    updated_at = greatest(public.match_live_states.updated_at, excluded.updated_at),
    updated_by_device_id = case
      when excluded.updated_at >= public.match_live_states.updated_at then excluded.updated_by_device_id
      else public.match_live_states.updated_by_device_id
    end
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.sync_match_live(uuid,uuid,uuid,uuid,uuid,jsonb,boolean,timestamptz) from public, anon;
grant execute on function public.sync_match_live(uuid,uuid,uuid,uuid,uuid,jsonb,boolean,timestamptz) to authenticated;

commit;
