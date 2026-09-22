begin;

-- =========================================================================
-- Fix: submit_result, sync_match_live und sync_team_visit prüften bisher nur,
-- dass der übergebene checkin_id zum Event und zur Station des Matches
-- gehört -- nicht mehr, dass der Check-in überhaupt vom *eigenen* Gerät
-- stammt. Da station_checkins per RLS für jedes Gerät mit Eventzugriff lesbar
-- ist (checkins_select: has_event_access(event_id)) und zusätzlich per
-- Realtime gebroadcastet wird, konnte ein beliebiges Stationsgerät die
-- checkin_id einer fremden Station auslesen und darüber Ergebnisse,
-- Live-Punktestände oder Ankunfts-/Abfahrtszeiten für Matches anderer
-- Stationen einreichen bzw. fälschen.
--
-- Fix: der Check-in muss zu einem device_event_access-Eintrag desselben
-- physischen Geräts (p_device_id) gehören -- nicht zwingend demselben
-- device_access_id-Eintrag (Session), damit ein erneuter Codebeitritt nach
-- Sitzungsverlust weiterhin frühere Check-ins desselben Geräts verwenden
-- darf (siehe ursprünglicher Kommentar in station_runtime.sql). Ein anderes
-- Gerät kann die checkin_id damit nicht mehr verwenden.
-- =========================================================================

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

  -- Der Check-in muss zum selben physischen Gerät gehören (über device_id,
  -- nicht device_access_id -- siehe Kommentar oben). Verhindert, dass ein
  -- fremdes Gerät eine ausgelesene checkin_id einer anderen Station nutzt.
  if not exists (
    select 1 from public.station_checkins sci
    join public.matches m on m.event_id = p_event_id and m.id = p_match_id
    join public.device_event_access dea2 on dea2.id = sci.device_access_id
    where sci.id = p_checkin_id and sci.event_id = p_event_id
      and sci.station_setup_id = m.station_setup_id
      and dea2.device_id = p_device_id
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
    nullif(value->>'measured_value','')::numeric, nullif(value->>'placement','')::integer
  from jsonb_array_elements(p_payload->'values') value;

  update public.matches
    set current_result_version = v_version,
        status = 'completed',
        actual_ended_at = coalesce(actual_ended_at, p_captured_at),
        updated_at = now()
  where id = p_match_id;

  return query select p_request_id, p_payload_hash, 'accepted'::text, v_version;
end;
$$;

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
  v_client_ts timestamptz := coalesce(p_updated_at, now());
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

commit;
