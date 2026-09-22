begin;

-- Wenn eine Veranstaltung komplett geloescht wird, verschwindet die
-- events-Zeile per Cascade VOR den abhaengigen match_participants-Zeilen.
-- Der Guard sah dann status=NULL, deutete das faelschlich als "nicht mehr
-- Entwurf" und blockierte damit jede Loeschung einer nicht-Entwurfs-
-- Veranstaltung mit "event is no longer a draft, this field is locked".
-- Nur noch sperren, wenn die Veranstaltung tatsaechlich existiert und
-- nicht (mehr) Entwurf ist.
create or replace function private.guard_locked_after_publish(p_event_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare v_status text;
begin
  select status into v_status from public.events where id = p_event_id;
  if v_status is not null and v_status <> 'draft' then
    raise exception 'event is no longer a draft, this field is locked';
  end if;
end;
$$;
revoke execute on function private.guard_locked_after_publish(uuid) from public, anon, authenticated;

commit;
