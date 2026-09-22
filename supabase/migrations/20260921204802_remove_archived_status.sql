begin;

-- "archiviert" faellt als eigener Zustand weg: eine Veranstaltung ist
-- entweder Entwurf, veroeffentlicht/laufend/beendet ("live"), oder sie
-- wird ueber delete_event() endgueltig geloescht.
update public.events set status = 'finished' where status = 'archived';

alter table public.events drop constraint events_status_check;
alter table public.events add constraint events_status_check
  check (status in ('draft','published','running','finished'));

create or replace function private.guard_event_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'draft' and new.status = 'published' then
    return new;
  end if;
  if old.status = 'published' and new.status in ('draft', 'running') then
    if new.status = 'draft' and exists (
      select 1 from public.result_submissions rs where rs.event_id = old.id
    ) then
      raise exception 'event has submissions, cannot return to draft';
    end if;
    return new;
  end if;
  if old.status = 'running' and new.status = 'finished' then
    return new;
  end if;
  raise exception 'invalid event status transition: % -> %', old.status, new.status;
end;
$$;
revoke execute on function private.guard_event_status() from public, anon, authenticated;

commit;
