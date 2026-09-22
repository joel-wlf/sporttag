begin;

-- =========================================================================
-- Veröffentlichte/laufende Events vollständig bearbeitbar machen.
--
-- Die Sperre "nur Entwürfe sind bearbeitbar" wird aufgehoben. Stattdessen
-- erhöhen strukturelle Änderungen an einem veröffentlichten oder laufenden
-- Event automatisch `events.plan_version`, damit Geräte das Offline-Paket neu
-- laden. Ergebnis-/Laufzeitänderungen an `matches` (Status, Ergebnisversion,
-- Live-Start) lösen bewusst KEINE neue Planversion aus, damit laufende
-- Abgaben nicht als Konflikt gelten.
-- =========================================================================

-- 1. Sperre neutralisieren. Dies ist der einzige Aufrufpunkt aller Guards
--    (scoring_rules, event_games, match_participants und die Plan-RPCs).
create or replace function private.guard_locked_after_publish(p_event_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Bewusst ohne Sperre: veröffentlichte Events bleiben bearbeitbar.
  return;
end;
$$;
revoke execute on function private.guard_locked_after_publish(uuid) from public, anon, authenticated;

-- 2. Automatische Planversion bei strukturellen Änderungen.
create or replace function private.bump_plan_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid := coalesce(new.event_id, old.event_id);
begin
  update public.events
    set plan_version = plan_version + 1, updated_at = now()
  where id = v_event_id and status in ('published', 'running');
  return coalesce(new, old);
end;
$$;
revoke execute on function private.bump_plan_version() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'teams', 'stations', 'scoring_rules', 'event_games', 'blocks', 'rounds',
    'station_setups', 'event_staff', 'station_assignments', 'game_assignments'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.bump_plan_version()',
      t || '_bump_plan_version', t
    );
  end loop;
end $$;

-- Matches nur bei Planung (anlegen/entfernen), nicht bei Laufzeit-/Ergebnis-Updates.
create trigger matches_bump_plan_version
  after insert or delete on public.matches
  for each row execute function private.bump_plan_version();

-- 3. Event-Einstellungen (Dauer, Startzeit, Zuordnungsart, Standardregel,
--    Gelände) erhöhen die Planversion über einen BEFORE-Trigger.
create or replace function private.bump_plan_version_on_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('published', 'running') and (
    new.round_minutes is distinct from old.round_minutes
    or new.changeover_minutes is distinct from old.changeover_minutes
    or new.break_minutes is distinct from old.break_minutes
    or new.schedule_start_time is distinct from old.schedule_start_time
    or new.staff_assignment_mode is distinct from old.staff_assignment_mode
    or new.default_scoring_rule_id is distinct from old.default_scoring_rule_id
    or new.venue_north is distinct from old.venue_north
    or new.venue_south is distinct from old.venue_south
    or new.venue_east is distinct from old.venue_east
    or new.venue_west is distinct from old.venue_west
  ) then
    new.plan_version := old.plan_version + 1;
  end if;
  return new;
end;
$$;
revoke execute on function private.bump_plan_version_on_settings() from public, anon, authenticated;
create trigger events_bump_plan_version_on_settings
  before update on public.events
  for each row execute function private.bump_plan_version_on_settings();

commit;
