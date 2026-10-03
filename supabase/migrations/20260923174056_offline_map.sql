-- Offline-Kartenbild: privater Storage-Bucket, Registrierung eines gebackenen
-- Kartenstands (event_maps) und Abruf des aktiven Stands für Stationsgeräte.
-- Siehe docs/datenkonzept.md Abschnitt "Offline-Kartenbild".

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-maps', 'event-maps', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Pfadschema: <event_id>/<beliebiger-name>. Der Ordnername entscheidet über den Zugriff.
create policy event_maps_storage_select on storage.objects for select to authenticated
  using (
    case
      when bucket_id = 'event-maps'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.has_event_access(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy event_maps_storage_insert on storage.objects for insert to authenticated
  with check (
    case
      when bucket_id = 'event-maps'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_event_organizer(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy event_maps_storage_delete on storage.objects for delete to authenticated
  using (
    case
      when bucket_id = 'event-maps'
        and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_event_organizer(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

-- Neuer Kartenstand: legt die nächste Version an und macht sie zur aktiven Karte.
create or replace function public.register_event_map(
  p_event_id uuid,
  p_asset_path text,
  p_content_hash text,
  p_mime_type text,
  p_width_px integer,
  p_height_px integer,
  p_north numeric,
  p_south numeric,
  p_east numeric,
  p_west numeric,
  p_source_label text default null,
  p_attribution text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_version integer;
  v_id uuid;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'Nur Organisatoren dürfen die Offline-Karte erstellen.' using errcode = '42501';
  end if;
  if split_part(p_asset_path, '/', 1) <> p_event_id::text then
    raise exception 'Der Kartenpfad muss unter der Veranstaltungs-ID liegen.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'event-maps' and o.name = p_asset_path
  ) then
    raise exception 'Das Kartenbild wurde nicht hochgeladen.' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.event_maps where event_id = p_event_id;

  insert into public.event_maps (
    event_id, version, asset_path, content_hash, mime_type, width_px, height_px,
    north, south, east, west, source_label, attribution
  ) values (
    p_event_id, v_version, p_asset_path, p_content_hash, p_mime_type, p_width_px, p_height_px,
    p_north, p_south, p_east, p_west, p_source_label, p_attribution
  ) returning id into v_id;

  update public.events set active_map_id = v_id where id = p_event_id;
  return v_id;
end;
$function$;

revoke execute on function public.register_event_map(uuid, text, text, text, integer, integer, numeric, numeric, numeric, numeric, text, text) from public, anon;
grant execute on function public.register_event_map(uuid, text, text, text, integer, integer, numeric, numeric, numeric, numeric, text, text) to authenticated;

-- Aktiver Kartenstand als kleines Objekt; Geräte laden Bild und Prüfsumme getrennt vom Paket.
create or replace function public.get_event_map(p_event_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', m.id, 'version', m.version, 'asset_path', m.asset_path,
    'content_hash', m.content_hash, 'mime_type', m.mime_type,
    'width_px', m.width_px, 'height_px', m.height_px, 'projection', m.projection,
    'north', m.north, 'south', m.south, 'east', m.east, 'west', m.west,
    'source_label', m.source_label, 'attribution', m.attribution
  )
  from public.event_maps m
  join public.events e on e.active_map_id = m.id and e.id = m.event_id
  where e.id = p_event_id;
$function$;

revoke execute on function public.get_event_map(uuid) from public, anon;
grant execute on function public.get_event_map(uuid) to authenticated;

-- Ein neuer Kartenstand erhöht die Planversion, damit Geräte ihn beim nächsten Sync laden.
create trigger event_maps_bump_plan_version
  after insert or update or delete on public.event_maps
  for each row execute function private.bump_plan_version();

commit;
