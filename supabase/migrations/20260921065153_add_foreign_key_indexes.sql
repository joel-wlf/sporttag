begin;

create index checkin_staff_event_checkin_idx on public.checkin_staff(event_id, checkin_id);
create index checkin_staff_event_staff_idx on public.checkin_staff(event_id, staff_id);
create index device_event_access_device_idx on public.device_event_access(device_id);
create index device_event_access_event_code_idx on public.device_event_access(event_id, access_code_id);
create index devices_registered_by_idx on public.devices(registered_by);
create index event_device_states_device_idx on public.event_device_states(device_id);
create index event_games_event_rule_idx on public.event_games(event_id, scoring_rule_id);
create index event_games_template_idx on public.event_games(template_id);
create index event_memberships_user_event_idx on public.event_memberships(user_id, event_id);
create index events_active_map_idx on public.events(id, active_map_id);
create index events_default_rule_idx on public.events(id, default_scoring_rule_id);
create index game_templates_owner_idx on public.game_templates(owner_id);
create index match_participants_event_match_idx on public.match_participants(event_id, match_id);
create index match_participants_event_team_idx on public.match_participants(event_id, team_id);
create index matches_event_rule_idx on public.matches(event_id, scoring_rule_id);
create index matches_event_setup_idx on public.matches(event_id, station_setup_id);
create index result_revisions_event_match_idx on public.result_revisions(event_id, match_id);
create index result_revisions_event_request_idx on public.result_revisions(event_id, request_id);
create index result_revisions_recorded_by_idx on public.result_revisions(recorded_by);
create index result_submissions_device_idx on public.result_submissions(device_id);
create index result_submissions_event_checkin_idx on public.result_submissions(event_id, checkin_id);
create index result_submissions_event_access_idx on public.result_submissions(event_id, device_access_id);
create index result_submissions_event_match_idx on public.result_submissions(event_id, match_id);
create index result_submissions_resolution_idx on public.result_submissions(resolution_request_id);
create index result_submissions_submitted_by_idx on public.result_submissions(submitted_by);
create index result_values_event_match_idx on public.result_values(event_id, match_id);
create index result_values_event_participant_idx on public.result_values(event_id, participant_id);
create index result_values_event_revision_idx on public.result_values(event_id, revision_id);
create index rounds_event_block_idx on public.rounds(event_id, block_id);
create index station_assignments_event_staff_idx on public.station_assignments(event_id, staff_id);
create index station_assignments_event_setup_idx on public.station_assignments(event_id, station_setup_id);
create index station_checkins_event_setup_idx on public.station_checkins(event_id, station_setup_id);
create index station_setups_event_block_idx on public.station_setups(event_id, block_id);
create index station_setups_event_game_idx on public.station_setups(event_id, event_game_id);
create index station_setups_event_station_idx on public.station_setups(event_id, station_id);

drop policy device_access_organizer_write on public.device_event_access;
create policy device_access_organizer_insert on public.device_event_access for insert to authenticated
  with check (private.is_event_organizer(event_id));
create policy device_access_organizer_update on public.device_event_access for update to authenticated
  using (private.is_event_organizer(event_id)) with check (private.is_event_organizer(event_id));
create policy device_access_organizer_delete on public.device_event_access for delete to authenticated
  using (private.is_event_organizer(event_id));

commit;
