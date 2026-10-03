-- Ein Stationsgerät kann offline schon ein Ergebnis zu einem Match gespeichert
-- haben, das der Server noch nicht kennt. Löscht die Leitung das Match
-- inzwischen (Zelle leeren, Runde/Station umplanen), lehnt der Server die
-- spätere Abgabe dauerhaft ab ("match not found"): das Ergebnis erreicht nie
-- die Tabelle. Deshalb gilt ein Match auch dann als historisch, sobald an
-- seiner Stationsbelegung jemand eingecheckt war; es wird dann abgesagt statt
-- gelöscht (datenkonzept.md 7 und 8.8). Teardown einer ganzen Veranstaltung
-- bleibt möglich.
create or replace function private.guard_match_history_delete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public.events e where e.id = old.event_id) then
    return old;
  end if;
  if private.match_has_history(old.id) then
    raise exception 'match_has_results'
      using detail = 'Match ' || old.id || ' hat Abgaben, Revisionen oder einen Laufzettel.';
  end if;
  if exists (
    select 1 from public.station_checkins sc
    where sc.station_setup_id = old.station_setup_id and sc.event_id = old.event_id
  ) then
    raise exception 'match_has_checkin'
      using detail = 'An der Stationsbelegung von Match ' || old.id || ' war bereits ein Gerät eingecheckt.';
  end if;
  return old;
end;
$function$;

-- Dieselbe Regel für die Stationsbelegung selbst: Sonst konnte das Löschen
-- einer Belegung (oder ihres Blocks) die Check-ins per Kaskade zuerst
-- entfernen und den Schutz oben umgehen.
create or replace function private.guard_setup_checkin_delete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not exists (select 1 from public.events e where e.id = old.event_id) then
    return old;
  end if;
  if exists (
    select 1 from public.station_checkins sc
    where sc.station_setup_id = old.id and sc.event_id = old.event_id
  ) then
    raise exception 'match_has_checkin'
      using detail = 'An der Stationsbelegung ' || old.id || ' war bereits ein Gerät eingecheckt.';
  end if;
  return old;
end;
$function$;

drop trigger if exists station_setups_guard_checkin_delete on public.station_setups;
create trigger station_setups_guard_checkin_delete
  before delete on public.station_setups
  for each row execute function private.guard_setup_checkin_delete();
