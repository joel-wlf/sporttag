-- Zwei Fehler in sync_station_checkin:
-- 1. Eine offline gewählte Betreuungsperson, die die Leitung inzwischen
--    gelöscht hat, ließ den ganzen Check-in am Fremdschlüssel von
--    checkin_staff scheitern. Weil Ergebnisse ihren Check-in brauchen, blieben
--    damit auch alle Ergebnisse dieses Check-ins dauerhaft auf dem Gerät.
--    Unbekannte Personen werden jetzt übersprungen (Namen sind Selbstauskunft).
-- 2. Der Upsert durfte checked_out_at eines Check-ins jedes Geräts ändern,
--    dessen ID bekannt war (station_checkins ist für alle Geräte des Events
--    lesbar). Jetzt nur noch für Check-ins desselben physischen Geräts.
create or replace function public.sync_station_checkin(
  p_id uuid,
  p_event_id uuid,
  p_station_setup_id uuid,
  p_device_id uuid,
  p_checked_in_at timestamp with time zone,
  p_checked_out_at timestamp with time zone default null,
  p_staff_ids uuid[] default '{}'
)
returns public.station_checkins
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_access public.device_event_access;
  v_row public.station_checkins;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;

  select * into v_access from public.device_event_access dea
  where dea.event_id = p_event_id and dea.device_id = p_device_id
    and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null;
  if v_access.id is null then raise exception 'device access is not authorized for this event'; end if;

  if not exists (
    select 1 from public.station_setups su where su.id = p_station_setup_id and su.event_id = p_event_id
  ) then
    raise exception 'station setup not found';
  end if;

  -- Beendet jeden anderen aktiven Check-in desselben Gerätezugangs (höchstens
  -- ein aktiver Check-in gleichzeitig, siehe datenkonzept.md Abschnitt 12).
  update public.station_checkins
  set checked_out_at = least(p_checked_in_at, now())
  where event_id = p_event_id and device_access_id = v_access.id
    and checked_out_at is null and id <> p_id;

  insert into public.station_checkins (
    id, event_id, station_setup_id, device_access_id, checked_in_at, checked_out_at
  ) values (
    p_id, p_event_id, p_station_setup_id, v_access.id, p_checked_in_at, p_checked_out_at
  )
  on conflict (event_id, id) do update set
    checked_out_at = excluded.checked_out_at
  where public.station_checkins.device_access_id in (
    select dea2.id from public.device_event_access dea2
    where dea2.event_id = p_event_id and dea2.device_id = p_device_id
  )
  returning * into v_row;
  if v_row.id is null then
    raise exception 'check-in belongs to another device';
  end if;

  delete from public.checkin_staff where checkin_id = p_id and event_id = p_event_id
    and staff_id <> all (coalesce(p_staff_ids, '{}'));
  insert into public.checkin_staff (checkin_id, staff_id, event_id)
  select p_id, es.id, p_event_id
  from public.event_staff es
  where es.event_id = p_event_id and es.id = any (coalesce(p_staff_ids, '{}'))
  on conflict (checkin_id, staff_id) do nothing;

  return v_row;
end;
$function$;
