-- Ein Stationsgerät durfte nur Abgaben lesen, die unter seinem aktuellen
-- Gerätezugang eingegangen sind. Nach einem erneuten Codebeitritt (neue
-- anonyme Sitzung, neuer device_event_access) sah es seine früheren Abgaben
-- nicht mehr, und deren Status blieb am Gerät für immer bei "Klärung nötig".
-- Jetzt gilt wie in submit_result: dasselbe physische Gerät mit aktivem Zugang.
drop policy submissions_select on public.result_submissions;
create policy submissions_select on public.result_submissions for select to authenticated using (
  private.is_event_organizer(event_id)
  or exists (
    select 1 from public.device_event_access dea
    where dea.event_id = result_submissions.event_id
      and dea.device_id = result_submissions.device_id
      and dea.auth_user_id = (select auth.uid())
      and dea.revoked_at is null
  )
);
