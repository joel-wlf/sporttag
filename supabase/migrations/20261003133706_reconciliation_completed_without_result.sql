-- Abschlussabgleich (datenkonzept.md 11.5): Ein Match, das ohne Ergebnis als
-- abgeschlossen markiert wurde (Live-Cockpit "Als beendet markieren"), galt
-- bisher als erledigt. Der Abgleich ließ sich bestätigen, obwohl das Match in
-- der Tabelle fehlte. Jetzt ist das ein eigener Fehler: Ergebnis nachtragen
-- oder das Match absagen.
create or replace function public.check_event_reconciliation(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare v_issues jsonb := '[]'::jsonb;
begin
  if not private.has_event_access(p_event_id) then raise exception 'event access required'; end if;

  if exists (
    select 1
    from (select distinct dea.device_id from public.device_event_access dea where dea.event_id = p_event_id) d
    left join public.event_device_states eds on eds.event_id = p_event_id and eds.device_id = d.device_id
    where coalesce(eds.expected, true)
      and eds.reconciled_at is null
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'device_not_reconciled', 'severity', 'error',
      'message', 'Mindestens ein erwartetes Gerät (auch widerrufene) hat noch kein bestätigtes Abschlussmanifest. Ein Gerät ohne Daten kann als nicht erwartet markiert werden.');
  end if;

  if exists (
    select 1 from public.result_submissions rs
    where rs.event_id = p_event_id and rs.status in ('conflict','needs_review')
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'open_conflicts', 'severity', 'error',
      'message', 'Es liegen ungeklärte Konflikte oder Korrekturvorschläge vor.');
  end if;

  if exists (
    select 1 from public.matches m
    where m.event_id = p_event_id and m.status not in ('completed','cancelled')
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'open_matches', 'severity', 'error',
      'message', 'Es gibt Matches ohne Ergebnis, die weder abgeschlossen noch abgesagt sind.');
  end if;

  if exists (
    select 1 from public.matches m
    where m.event_id = p_event_id and m.status = 'completed'
      and not exists (
        select 1 from public.result_revisions rr
        join public.result_values rv on rv.revision_id = rr.id
        where rr.match_id = m.id and rr.version = m.current_result_version
      )
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'completed_without_result', 'severity', 'error',
      'message', 'Mindestens ein Match ist als beendet markiert, hat aber kein gültiges Ergebnis. Ergebnis nachtragen oder das Match absagen.');
  end if;

  return v_issues;
end;
$function$;
