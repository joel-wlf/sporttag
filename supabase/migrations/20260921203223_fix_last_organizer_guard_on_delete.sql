begin;

-- Der Trigger sollte nur das Deaktivieren (soft-remove) des letzten aktiven
-- Organisators verhindern, waehrend die Veranstaltung noch existiert. Beim
-- endgueltigen Loeschen der Veranstaltung (delete_event, cascade von
-- events -> event_memberships) werden alle Mitgliedschaften mitgeloescht,
-- was frueher denselben Guard ausgeloest und das Loeschen blockiert hat.
drop trigger memberships_guard_last_organizer on public.event_memberships;

create trigger memberships_guard_last_organizer
  before update of active on public.event_memberships
  for each row execute function private.guard_last_organizer();

commit;
