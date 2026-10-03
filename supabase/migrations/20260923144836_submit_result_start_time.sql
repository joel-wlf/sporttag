begin;

-- =========================================================================
-- submit_result: Startzeit mitsetzen.
--
-- Beim Annehmen setzte die Funktion `actual_ended_at`, ließ aber
-- `actual_started_at` leer, wenn der Live-Start (sync_match_live) nie
-- übertragen wurde. Das verletzte den Check `matches_check` (Ende nur mit
-- Start): Die Abgabe wurde dauerhaft abgelehnt, das Gerät versuchte es bei
-- jedem Sync erneut, und das Ergebnis fehlte zentral. Ein Match darf laut
-- docs/datenkonzept.md 7 direkt von `scheduled` zu `completed` gehen.
-- Sonst unverändert gegenüber 20260921200000_station_runtime.
-- =========================================================================
create or replace function public.submit_result(p_request_id uuid, p_event_id uuid, p_match_id uuid, p_device_id uuid, p_device_access_id uuid, p_checkin_id uuid, p_local_sequence bigint, p_base_result_version integer, p_plan_version integer, p_payload jsonb, p_payload_hash text, p_captured_at timestamp with time zone, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(request_id uuid, payload_hash text, status text, result_version integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    join public.device_event_access dea2 on dea2.id = sci.device_access_id
    where sci.id = p_checkin_id and sci.event_id = p_event_id
      and sci.station_setup_id = m.station_setup_id
      and dea2.device_id = p_device_id
  ) then
    raise exception 'check-in does not match this station setup';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id and m.event_id = p_event_id for update;
  if not found then raise exception 'match not found'; end if;

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

  -- Ein Match darf direkt von `scheduled` zu `completed` gehen (docs/datenkonzept.md 7),
  -- auch wenn der Live-Start nie übertragen wurde. Ohne Startzeit verletzte das
  -- gesetzte Ende `matches_check`, und die Abgabe wurde bei jedem Sync erneut abgelehnt.
  update public.matches
    set current_result_version = v_version,
        status = 'completed',
        actual_started_at = coalesce(actual_started_at, least(p_captured_at, coalesce(actual_ended_at, p_captured_at))),
        actual_ended_at = coalesce(actual_ended_at, p_captured_at),
        updated_at = now()
  where id = p_match_id;

  return query select p_request_id, p_payload_hash, 'accepted'::text, v_version;
end;
$function$;

commit;
