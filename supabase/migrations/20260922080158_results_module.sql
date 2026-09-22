-- -------------------------------------------------------------------------
-- Modul "Ergebnisse & Tabelle": Organisatorkorrektur, Konfliktklärung und
-- eine Tabelle mit Rang und Aufschlüsselung je Match
-- (docs/datenkonzept.md Abschnitt 4, 5, 8.2, 11).
-- -------------------------------------------------------------------------

-- 1. Organisatorpfad in result_submissions zulassen. Bisher erzwingen
--    device_id/local_sequence NOT NULL den Gerätepfad; die XOR-Prüfung
--    submitted_by <> device_access_id existiert dafür bereits.
alter table public.result_submissions alter column device_id drop not null;
alter table public.result_submissions alter column local_sequence drop not null;
alter table public.result_submissions drop constraint result_submissions_local_sequence_check;
alter table public.result_submissions add constraint result_submissions_local_sequence_check
  check (local_sequence is null or local_sequence > 0);

-- -------------------------------------------------------------------------
-- 2. Punkte je Match und Team, als Grundlage für die Tabelle und ihre
--    Aufschlüsselung. Ersetzt die bisher in `standings` eingebettete Logik.
-- -------------------------------------------------------------------------
create or replace view public.result_points with (security_invoker = true) as
select
  m.event_id,
  m.id as match_id,
  crv.team_id,
  crv.version,
  crv.recorded_at,
  crv.placement,
  crv.measured_value,
  sr.mode as rule_mode,
  case
    when sr.mode = 'win_draw_loss' and crv.placement = 1 and winners.winner_count = 1 then (sr.config->>'win')::numeric
    when sr.mode = 'win_draw_loss' and crv.placement = 1 and winners.winner_count > 1 then (sr.config->>'draw')::numeric
    when sr.mode = 'win_draw_loss' then (sr.config->>'loss')::numeric
    when sr.mode = 'placement' then coalesce((sr.config->'points_by_place'->>crv.placement::text)::numeric, (sr.config->>'unlisted_points')::numeric, 0)
    when sr.mode = 'raw_value' then coalesce(crv.measured_value,0) * coalesce((sr.config->>'factor')::numeric,1)
    else 0
  end as points,
  case
    when sr.mode <> 'win_draw_loss' then null
    when crv.placement = 1 and winners.winner_count = 1 then 'win'
    when crv.placement = 1 and winners.winner_count > 1 then 'draw'
    else 'loss'
  end as outcome
from public.matches m
join public.current_result_values crv on crv.match_id = m.id
join public.scoring_rules sr on sr.id = m.scoring_rule_id
left join lateral (
  select count(*)::integer as winner_count from public.current_result_values x
  where x.match_id = crv.match_id and x.placement = 1
) winners on true
where m.status = 'completed' and m.counts_for_ranking;

-- Tabelle: Rang (geteilt bei Gleichstand), Spiele, S/U/N und Punktesumme.
-- Spaltenreihenfolge event_id..last_result_at bleibt erhalten, neue Spalten
-- werden angehängt (CREATE OR REPLACE VIEW erlaubt keine Umstellung).
create or replace view public.standings with (security_invoker = true) as
with agg as (
  select
    t.event_id,
    t.id as team_id,
    t.name as team_name,
    coalesce(sum(rp.points), 0) as table_points,
    max(rp.recorded_at) as last_result_at,
    count(rp.match_id) as matches_played,
    count(*) filter (where rp.outcome = 'win') as wins,
    count(*) filter (where rp.outcome = 'draw') as draws,
    count(*) filter (where rp.outcome = 'loss') as losses
  from public.teams t
  left join public.result_points rp on rp.team_id = t.id
  group by t.event_id, t.id, t.name
)
select
  agg.*,
  rank() over (partition by agg.event_id order by agg.table_points desc) as rank
from agg;

-- -------------------------------------------------------------------------
-- 3. Organisatorkorrektur mit Pflichtbegründung (datenkonzept.md 5, 8.2).
--    Optimistische Sperre über die Basisversion; kann zugleich offene
--    Abgaben als geklärt markieren (`p_resolves`).
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
  -- nicht erlaubt (datenkonzept.md Abschnitt 5); submit_result prüft das
  -- bisher nicht, hier wird es nachgeholt.
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
    encode(digest(p_payload::text, 'sha256'), 'hex'), 'accepted', now()
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

-- -------------------------------------------------------------------------
-- 4. Abgaben ohne neue Revision klären: identisch mit dem aktuellen Stand,
--    oder verworfen. Ebenfalls mit Pflichtbegründung, protokolliert am
--    betroffenen Match (gleiches Muster wie der Live-Statuswechsel).
-- -------------------------------------------------------------------------
create or replace function public.dismiss_submissions(
  p_event_id uuid,
  p_request_ids uuid[],
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text;
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not private.is_event_organizer(p_event_id) then raise exception 'organizer membership required'; end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then raise exception 'reason_required'; end if;
  if coalesce(array_length(p_request_ids, 1), 0) = 0 then raise exception 'no submissions given'; end if;

  update public.result_submissions
  set status = 'resolved'
  where event_id = p_event_id
    and request_id = any (p_request_ids)
    and status in ('conflict', 'needs_review');
  get diagnostics v_count = row_count;

  if v_count > 0 then
    update public.matches m
    set notes = case
        when m.notes is not null and length(m.notes) > 0
          then m.notes || chr(10) || '[' || to_char(now(), 'DD.MM.YYYY HH24:MI') || '] ' || v_reason
        else '[' || to_char(now(), 'DD.MM.YYYY HH24:MI') || '] ' || v_reason
      end,
      updated_at = now()
    where m.id in (
      select distinct rs.match_id from public.result_submissions rs
      where rs.event_id = p_event_id and rs.request_id = any (p_request_ids)
    );
  end if;

  return v_count;
end;
$$;
revoke execute on function public.dismiss_submissions(uuid,uuid[],text) from public, anon;
grant execute on function public.dismiss_submissions(uuid,uuid[],text) to authenticated;

-- -------------------------------------------------------------------------
-- 5. Grants für die neue View (result_points existierte vorher nicht).
-- -------------------------------------------------------------------------
grant select on public.result_points to authenticated;
