begin;

-- =========================================================================
-- Ergebnis weich löschen ("zurückziehen").
--
-- Das Match wird wieder geöffnet (Status `scheduled`, kein aktuelles
-- Ergebnis), zählt nicht mehr in der Tabelle, aber die Revisions- und
-- Abgabehistorie bleibt vollständig nachvollziehbar. Die Zurückziehung ist
-- eine leere Revision mit Pflichtbegründung (docs/datenkonzept.md 5, 8.2).
-- =========================================================================
create or replace function public.withdraw_result(
  p_event_id uuid,
  p_match_id uuid,
  p_reason text
)
returns table (request_id uuid, result_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_request_id uuid;
  v_version integer;
  v_reason text;
  v_plan_version integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not private.is_event_organizer(p_event_id) then raise exception 'organizer membership required'; end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then raise exception 'reason_required'; end if;

  select * into v_match from public.matches m
  where m.id = p_match_id and m.event_id = p_event_id for update;
  if not found then raise exception 'match not found'; end if;
  if v_match.current_result_version = 0 then raise exception 'no result to withdraw'; end if;

  select e.plan_version into v_plan_version from public.events e where e.id = p_event_id;

  v_request_id := gen_random_uuid();
  insert into public.result_submissions (
    request_id, event_id, match_id, device_id, submitted_by, device_access_id, checkin_id,
    local_sequence, base_result_version, plan_version, payload, payload_hash, status, captured_at
  ) values (
    v_request_id, p_event_id, p_match_id, null, (select auth.uid()), null, null,
    null, v_match.current_result_version, v_plan_version, '{"values":[]}'::jsonb,
    encode(extensions.digest('{"values":[]}'::text, 'sha256'), 'hex'), 'accepted', now()
  );

  -- Leere Revision: bewusst ohne result_values, damit current_result_values
  -- für dieses Match keine Zeile liefert und die Tabelle es nicht zählt.
  v_version := v_match.current_result_version + 1;
  insert into public.result_revisions (event_id, match_id, version, recorded_by, reason, request_id)
  values (p_event_id, p_match_id, v_version, (select auth.uid()), v_reason, v_request_id);

  update public.matches
    set current_result_version = v_version,
        status = 'scheduled',
        actual_ended_at = null,
        updated_at = now()
  where id = p_match_id;

  return query select v_request_id, v_version;
end;
$$;
revoke execute on function public.withdraw_result(uuid,uuid,text) from public, anon;
grant execute on function public.withdraw_result(uuid,uuid,text) to authenticated;

commit;
