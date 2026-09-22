begin;

-- Veröffentlichung erzeugt jetzt direkt einen frischen Veranstaltungscode und gibt ihn zurück.
drop function if exists public.publish_event(uuid);

create function public.publish_event(p_event_id uuid)
returns table (event public.events, access_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare v_event public.events;
declare v_issues jsonb;
declare v_errors jsonb;
declare v_code text;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then raise exception 'event not found'; end if;
  if v_event.status <> 'draft' then
    raise exception 'only draft events can be published';
  end if;

  v_issues := public.check_event_readiness(p_event_id);
  select jsonb_agg(issue) into v_errors
  from jsonb_array_elements(v_issues) issue
  where issue->>'severity' = 'error';
  if v_errors is not null then
    raise exception 'event is not ready to publish: %', v_errors;
  end if;

  update public.matches m
  set scoring_rule_id = coalesce(
    m.scoring_rule_id,
    (
      select g.scoring_rule_id from public.station_setups ss
      join public.event_games g on g.event_id = ss.event_id and g.id = ss.event_game_id
      where ss.id = m.station_setup_id
    ),
    v_event.default_scoring_rule_id
  )
  where m.event_id = p_event_id and m.status <> 'cancelled';

  update public.events
  set status = 'published', plan_version = plan_version + 1
  where id = p_event_id
  returning * into v_event;

  v_code := public.rotate_access_code(p_event_id);

  return query select v_event, v_code;
end;
$$;
revoke execute on function public.publish_event(uuid) from public, anon;
grant execute on function public.publish_event(uuid) to authenticated;

-- Endgültiges Löschen einer Veranstaltung, unabhängig vom Status (nutzt die Cascade-FKs).
create function public.delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  if not exists (select 1 from public.events where id = p_event_id) then
    raise exception 'event not found';
  end if;
  delete from public.events where id = p_event_id;
end;
$$;
revoke execute on function public.delete_event(uuid) from public, anon;
grant execute on function public.delete_event(uuid) to authenticated;

commit;
