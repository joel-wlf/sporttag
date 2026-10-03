-- Nutzerentscheidung 23.09.2026 (datenkonzept.md 8.9/11.4): Konflikt je Match
-- statt je Gesamtplan. Eine Abgabe mit älterer plan_version wird angenommen,
-- wenn Station und Teams des Matches unverändert sind.
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
  p_captured_at timestamp with time zone,
  p_reason text default null::text
)
returns table(request_id uuid, payload_hash text, status text, result_version integer)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_match public.matches%rowtype;
  v_existing public.result_submissions%rowtype;
  v_revision_id uuid;
  v_version integer;
  v_access public.device_event_access;
  v_status text;
  v_checkin_setup uuid;
  v_base_has_values boolean;
  v_payload_ok boolean;
  v_allow_ties boolean;
  v_tie_count integer;
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

  select * into v_access from public.device_event_access dea
  where dea.id = p_device_access_id and dea.event_id = p_event_id
    and dea.device_id = p_device_id and dea.auth_user_id = (select auth.uid())
    and dea.revoked_at is null;
  if v_access.id is null then
    raise exception 'device access is not authorized for this event';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id and m.event_id = p_event_id for update;
  if not found then raise exception 'match not found'; end if;

  -- Der Check-in muss von diesem Gerät stammen. Liegt er an einer anderen
  -- Belegung als das Match (Match nach dem Erfassen verlegt), wird die Abgabe
  -- als Konflikt gesichert statt abgewiesen.
  select sci.station_setup_id into v_checkin_setup
  from public.station_checkins sci
  join public.device_event_access dea2 on dea2.id = sci.device_access_id
  where sci.id = p_checkin_id and sci.event_id = p_event_id
    and dea2.device_id = p_device_id;
  if v_checkin_setup is null then
    raise exception 'check-in does not match this station setup';
  end if;

  -- Passt die Payload genau zu den Teilnehmenden des Matches?
  v_payload_ok :=
    (select count(*) from jsonb_array_elements(p_payload->'values')) =
      (select count(*) from public.match_participants mp where mp.match_id = p_match_id)
    and not exists (
      select 1 from jsonb_array_elements(p_payload->'values') value
      left join public.match_participants mp
        on mp.id = (value->>'participant_id')::uuid and mp.match_id = p_match_id
      where mp.id is null
    )
    and (select count(distinct value->>'participant_id') from jsonb_array_elements(p_payload->'values') value) =
      (select count(*) from jsonb_array_elements(p_payload->'values'));

  -- Korrektur nur, wenn die Basis tatsächlich Werte hatte; nach einem
  -- Rückzug (leere Revision) ist eine neue Abgabe eine Erstabgabe.
  v_base_has_values := p_base_result_version > 0 and exists (
    select 1 from public.result_revisions rr
    join public.result_values rv on rv.revision_id = rr.id
    where rr.match_id = p_match_id and rr.version = p_base_result_version
  );

  select eg.allow_ties into v_allow_ties
  from public.station_setups ss join public.event_games eg on eg.id = ss.event_game_id
  where ss.id = v_match.station_setup_id;
  select count(*) into v_tie_count
  from jsonb_array_elements(p_payload->'values') value
  where nullif(value->>'placement', '')::integer = 1;

  v_status := case
    when v_base_has_values then 'needs_review'
    when v_checkin_setup <> v_match.station_setup_id or not v_payload_ok then 'conflict'
    -- Die Planversion allein ist kein Konfliktgrund mehr: jede Planänderung
    -- (auch eine umbenannte Betreuungsperson) machte sonst alle offline
    -- erfassten Ergebnisse zu Konflikten. Maßgeblich ist, ob sich für dieses
    -- Match Station (Check-in-Belegung, oben) oder Teams (Teilnehmer-IDs in
    -- v_payload_ok; Teamwechsel legen neue Teilnahmen an) geändert haben.
    when v_match.current_result_version = p_base_result_version
      and v_match.status <> 'cancelled'
      then case when coalesce(v_allow_ties, true) = false and v_tie_count > 1 then 'needs_review' else 'accepted' end
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

  v_version := v_match.current_result_version + 1;
  insert into public.result_revisions(event_id,match_id,version,reason,request_id)
  values (p_event_id,p_match_id,v_version,p_reason,p_request_id)
  returning id into v_revision_id;

  insert into public.result_values(revision_id,participant_id,event_id,match_id,measured_value,placement)
  select v_revision_id, (value->>'participant_id')::uuid, p_event_id, p_match_id,
    nullif(value->>'measured_value','')::numeric, nullif(value->>'placement','')::integer
  from jsonb_array_elements(p_payload->'values') value;

  -- Ein Match darf direkt von `scheduled` zu `completed` gehen (docs/datenkonzept.md 7),
  -- auch wenn der Live-Start nie übertragen wurde.
  update public.matches
    set current_result_version = v_version,
        status = 'completed',
        actual_started_at = coalesce(actual_started_at, least(p_captured_at, coalesce(actual_ended_at, p_captured_at))),
        actual_ended_at = coalesce(actual_ended_at, greatest(p_captured_at, coalesce(actual_started_at, p_captured_at))),
        updated_at = now()
  where id = p_match_id;

  return query select p_request_id, p_payload_hash, 'accepted'::text, v_version;
end;
$function$;

-- Teamwechsel müssen neue Teilnahmen anlegen (neue IDs), damit eine offline
-- erfasste Abgabe mit alten Teilnehmer-IDs als Konflikt erkannt wird. Der
-- Client ändert Teilnahmen ohnehin nur per Löschen/Anlegen; das sichert es ab.
create or replace function private.guard_participant_identity()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.team_id is distinct from old.team_id or new.match_id is distinct from old.match_id then
    raise exception 'match participants cannot change team or match; delete and re-create instead';
  end if;
  return new;
end;
$function$;

drop trigger if exists match_participants_guard_identity on public.match_participants;
create trigger match_participants_guard_identity
  before update on public.match_participants
  for each row execute function private.guard_participant_identity();
