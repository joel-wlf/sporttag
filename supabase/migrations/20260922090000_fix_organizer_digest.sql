-- -------------------------------------------------------------------------
-- Fix: `organizer_record_result` rief `digest(...)` unqualifiziert auf,
-- obwohl die Funktion mit `set search_path = ''` läuft. pgcrypto liegt in
-- Supabase im Schema `extensions`; ohne Qualifizierung schlägt das Übernehmen
-- einer Korrektur mit "function digest(text, unknown) does not exist" fehl.
-- Der Aufruf wird zu `extensions.digest(...)`, wie bereits `extensions.hmac`
-- in `private.access_code_digest`.
-- -------------------------------------------------------------------------
create or replace function public.organizer_record_result(
  p_event_id uuid,
  p_match_id uuid,
  p_base_result_version integer,
  p_payload jsonb,
  p_reason text default null,
  p_resolves uuid[] default '{}'
)
returns table (request_id uuid, result_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_game public.event_games%rowtype;
  v_request_id uuid;
  v_version integer;
  v_revision_id uuid;
  v_reason text;
  v_plan_version integer;
  v_tie_count integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not private.is_event_organizer(p_event_id) then raise exception 'organizer membership required'; end if;
  if p_payload is null or jsonb_typeof(p_payload->'values') <> 'array' then
    raise exception 'invalid submission payload';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id and m.event_id = p_event_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.status = 'cancelled' then raise exception 'match is cancelled'; end if;

  if v_match.current_result_version <> p_base_result_version then
    raise exception 'result_version_changed';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if (p_base_result_version > 0 or coalesce(array_length(p_resolves, 1), 0) > 0) and v_reason is null then
    raise exception 'reason_required';
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

  -- Unentschieden sind bei allow_ties=false auch in einer Organisatorkorrektur
  -- nicht erlaubt (datenkonzept.md Abschnitt 5).
  select eg.* into v_game
  from public.station_setups ss
  join public.event_games eg on eg.id = ss.event_game_id
  where ss.id = v_match.station_setup_id;

  if found and not v_game.allow_ties then
    select count(*) into v_tie_count
    from jsonb_array_elements(p_payload->'values') value
    where (value->>'placement')::integer = 1;
    if v_tie_count > 1 then raise exception 'ties_not_allowed'; end if;
  end if;

  select e.plan_version into v_plan_version from public.events e where e.id = p_event_id;

  v_request_id := gen_random_uuid();
  insert into public.result_submissions (
    request_id, event_id, match_id, device_id, submitted_by, device_access_id, checkin_id,
    local_sequence, base_result_version, plan_version, payload, payload_hash, status, captured_at
  ) values (
    v_request_id, p_event_id, p_match_id, null, (select auth.uid()), null, null,
    null, p_base_result_version, v_plan_version, p_payload,
    encode(extensions.digest(p_payload::text, 'sha256'), 'hex'), 'accepted', now()
  );

  v_version := v_match.current_result_version + 1;
  insert into public.result_revisions (event_id, match_id, version, recorded_by, reason, request_id)
  values (p_event_id, p_match_id, v_version, (select auth.uid()), v_reason, v_request_id)
  returning id into v_revision_id;

  insert into public.result_values (revision_id, participant_id, event_id, match_id, measured_value, placement)
  select v_revision_id, (value->>'participant_id')::uuid, p_event_id, p_match_id,
    nullif(value->>'measured_value', '')::numeric,
    nullif(value->>'placement', '')::integer
  from jsonb_array_elements(p_payload->'values') value;

  update public.matches set current_result_version = v_version, status = 'completed', updated_at = now()
  where id = p_match_id;

  if coalesce(array_length(p_resolves, 1), 0) > 0 then
    update public.result_submissions
    set status = 'resolved', resolution_request_id = v_request_id
    where event_id = p_event_id and match_id = p_match_id
      and request_id = any (p_resolves)
      and status in ('conflict', 'needs_review');
  end if;

  return query select v_request_id, v_version;
end;
$$;
revoke execute on function public.organizer_record_result(uuid,uuid,integer,jsonb,text,uuid[]) from public, anon;
grant execute on function public.organizer_record_result(uuid,uuid,integer,jsonb,text,uuid[]) to authenticated;
