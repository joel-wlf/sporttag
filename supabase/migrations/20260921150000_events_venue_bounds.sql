-- Gelände-Rechteck (WGS84-Grenzen) für die Planungskarte. Getrennt von event_maps,
-- da event_maps ein bereits gebackenes Offline-Kartenasset voraussetzt (asset_path etc.
-- sind NOT NULL), während das Rechteck schon vor einem gebackenen Kartenstand existiert.
alter table public.events
  add column venue_north numeric(9, 6) check (venue_north between -85.051129 and 85.051129),
  add column venue_south numeric(9, 6) check (venue_south between -85.051129 and 85.051129),
  add column venue_east numeric(10, 6) check (venue_east between -180 and 180),
  add column venue_west numeric(10, 6) check (venue_west between -180 and 180),
  add constraint events_venue_bounds_consistent check (
    (venue_north is null and venue_south is null and venue_east is null and venue_west is null)
    or (
      venue_north is not null and venue_south is not null and venue_east is not null and venue_west is not null
      and venue_north > venue_south and venue_east > venue_west
    )
  );
