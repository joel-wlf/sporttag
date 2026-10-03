begin;

-- Nachschärfung zu 20260923144836_submit_result_start_time: Meldet ein anderes
-- Gerät eine spätere Live-Startzeit als der Erfassungszeitpunkt (Uhrzeit-
-- abweichung zwischen Geräten), läge das gesetzte Ende vor dem Start und
-- `matches_check` griffe erneut. Das Ende ist deshalb mindestens der Start.
do $$
declare v_def text := pg_get_functiondef('public.submit_result'::regproc);
begin
  if position('actual_ended_at = coalesce(actual_ended_at, p_captured_at),' in v_def) = 0 then
    raise exception 'submit_result hat nicht die erwartete Fassung';
  end if;
  execute replace(v_def,
    'actual_ended_at = coalesce(actual_ended_at, p_captured_at),',
    'actual_ended_at = coalesce(actual_ended_at, greatest(p_captured_at, coalesce(actual_started_at, p_captured_at))),');
end $$;

commit;
