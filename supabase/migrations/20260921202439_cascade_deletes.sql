begin;

-- Deleting an event should tear down everything scoped to it.
alter table public.event_memberships drop constraint event_memberships_event_id_fkey,
  add constraint event_memberships_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.scoring_rules drop constraint scoring_rules_event_id_fkey,
  add constraint scoring_rules_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.event_maps drop constraint event_maps_event_id_fkey,
  add constraint event_maps_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.teams drop constraint teams_event_id_fkey,
  add constraint teams_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.stations drop constraint stations_event_id_fkey,
  add constraint stations_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.event_games drop constraint event_games_event_id_fkey,
  add constraint event_games_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.blocks drop constraint blocks_event_id_fkey,
  add constraint blocks_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.event_staff drop constraint event_staff_event_id_fkey,
  add constraint event_staff_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.event_access_codes drop constraint event_access_codes_event_id_fkey,
  add constraint event_access_codes_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.device_event_access drop constraint device_event_access_event_id_fkey,
  add constraint device_event_access_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.event_device_states drop constraint event_device_states_event_id_fkey,
  add constraint event_device_states_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;

-- Deleting a game should remove its station setups (and, transitively, matches/results for those setups).
alter table public.station_setups drop constraint station_setups_event_id_event_game_id_fkey,
  add constraint station_setups_event_id_event_game_id_fkey foreign key (event_id, event_game_id) references public.event_games(event_id, id) on delete cascade;
alter table public.game_assignments drop constraint game_assignments_event_id_event_game_id_fkey,
  add constraint game_assignments_event_id_event_game_id_fkey foreign key (event_id, event_game_id) references public.event_games(event_id, id) on delete cascade;

-- Deleting a block removes its rounds and station setups.
alter table public.rounds drop constraint rounds_event_id_block_id_fkey,
  add constraint rounds_event_id_block_id_fkey foreign key (event_id, block_id) references public.blocks(event_id, id) on delete cascade;
alter table public.station_setups drop constraint station_setups_event_id_block_id_fkey,
  add constraint station_setups_event_id_block_id_fkey foreign key (event_id, block_id) references public.blocks(event_id, id) on delete cascade;

-- Deleting a station removes its station setups.
alter table public.station_setups drop constraint station_setups_event_id_station_id_fkey,
  add constraint station_setups_event_id_station_id_fkey foreign key (event_id, station_id) references public.stations(event_id, id) on delete cascade;

-- Deleting a station setup removes matches, staff assignments and check-ins scheduled against it.
alter table public.matches drop constraint matches_event_id_station_setup_id_fkey,
  add constraint matches_event_id_station_setup_id_fkey foreign key (event_id, station_setup_id) references public.station_setups(event_id, id) on delete cascade;
alter table public.station_assignments drop constraint station_assignments_event_id_station_setup_id_fkey,
  add constraint station_assignments_event_id_station_setup_id_fkey foreign key (event_id, station_setup_id) references public.station_setups(event_id, id) on delete cascade;
alter table public.station_checkins drop constraint station_checkins_event_id_station_setup_id_fkey,
  add constraint station_checkins_event_id_station_setup_id_fkey foreign key (event_id, station_setup_id) references public.station_setups(event_id, id) on delete cascade;

-- Deleting event staff removes their assignments and check-in records.
alter table public.station_assignments drop constraint station_assignments_event_id_staff_id_fkey,
  add constraint station_assignments_event_id_staff_id_fkey foreign key (event_id, staff_id) references public.event_staff(event_id, id) on delete cascade;
alter table public.checkin_staff drop constraint checkin_staff_event_id_staff_id_fkey,
  add constraint checkin_staff_event_id_staff_id_fkey foreign key (event_id, staff_id) references public.event_staff(event_id, id) on delete cascade;
alter table public.game_assignments drop constraint game_assignments_event_id_staff_id_fkey,
  add constraint game_assignments_event_id_staff_id_fkey foreign key (event_id, staff_id) references public.event_staff(event_id, id) on delete cascade;

-- Deleting a round removes its matches.
alter table public.matches drop constraint matches_event_id_round_id_fkey,
  add constraint matches_event_id_round_id_fkey foreign key (event_id, round_id) references public.rounds(event_id, id) on delete cascade;

-- Deleting a match removes its participants and recorded results.
alter table public.match_participants drop constraint match_participants_event_id_match_id_fkey,
  add constraint match_participants_event_id_match_id_fkey foreign key (event_id, match_id) references public.matches(event_id, id) on delete cascade;
alter table public.result_submissions drop constraint result_submissions_event_id_match_id_fkey,
  add constraint result_submissions_event_id_match_id_fkey foreign key (event_id, match_id) references public.matches(event_id, id) on delete cascade;
alter table public.result_revisions drop constraint result_revisions_event_id_match_id_fkey,
  add constraint result_revisions_event_id_match_id_fkey foreign key (event_id, match_id) references public.matches(event_id, id) on delete cascade;
alter table public.result_values drop constraint result_values_event_id_match_id_fkey,
  add constraint result_values_event_id_match_id_fkey foreign key (event_id, match_id) references public.matches(event_id, id) on delete cascade;

-- Deleting a team removes its match participation and results.
alter table public.match_participants drop constraint match_participants_event_id_team_id_fkey,
  add constraint match_participants_event_id_team_id_fkey foreign key (event_id, team_id) references public.teams(event_id, id) on delete cascade;
alter table public.result_values drop constraint result_values_event_id_participant_id_fkey,
  add constraint result_values_event_id_participant_id_fkey foreign key (event_id, participant_id) references public.match_participants(event_id, id) on delete cascade;

-- Deleting a result submission removes its revisions and recorded values.
alter table public.result_revisions drop constraint result_revisions_event_id_request_id_fkey,
  add constraint result_revisions_event_id_request_id_fkey foreign key (event_id, request_id) references public.result_submissions(event_id, request_id) on delete cascade;
alter table public.result_values drop constraint result_values_event_id_revision_id_fkey,
  add constraint result_values_event_id_revision_id_fkey foreign key (event_id, revision_id) references public.result_revisions(event_id, id) on delete cascade;

-- Deleting a check-in removes its staff links and result submissions tied to it.
alter table public.checkin_staff drop constraint checkin_staff_event_id_checkin_id_fkey,
  add constraint checkin_staff_event_id_checkin_id_fkey foreign key (event_id, checkin_id) references public.station_checkins(event_id, id) on delete cascade;
alter table public.result_submissions drop constraint result_submissions_event_id_checkin_id_fkey,
  add constraint result_submissions_event_id_checkin_id_fkey foreign key (event_id, checkin_id) references public.station_checkins(event_id, id) on delete cascade;

-- Deleting a device's event access removes its check-ins and result submissions.
alter table public.station_checkins drop constraint station_checkins_event_id_device_access_id_fkey,
  add constraint station_checkins_event_id_device_access_id_fkey foreign key (event_id, device_access_id) references public.device_event_access(event_id, id) on delete cascade;
alter table public.result_submissions drop constraint result_submissions_event_id_device_access_id_fkey,
  add constraint result_submissions_event_id_device_access_id_fkey foreign key (event_id, device_access_id) references public.device_event_access(event_id, id) on delete cascade;

-- Deleting a device removes its event access, device state and result submissions.
alter table public.device_event_access drop constraint device_event_access_device_id_fkey,
  add constraint device_event_access_device_id_fkey foreign key (device_id) references public.devices(id) on delete cascade;
alter table public.event_device_states drop constraint event_device_states_device_id_fkey,
  add constraint event_device_states_device_id_fkey foreign key (device_id) references public.devices(id) on delete cascade;
alter table public.result_submissions drop constraint result_submissions_device_id_fkey,
  add constraint result_submissions_device_id_fkey foreign key (device_id) references public.devices(id) on delete cascade;

-- Optional cross-links: null out rather than block deletion of the referenced row.
alter table public.event_games drop constraint event_games_event_id_scoring_rule_id_fkey,
  add constraint event_games_event_id_scoring_rule_id_fkey foreign key (event_id, scoring_rule_id) references public.scoring_rules(event_id, id) on delete set null;
alter table public.matches drop constraint matches_event_id_scoring_rule_id_fkey,
  add constraint matches_event_id_scoring_rule_id_fkey foreign key (event_id, scoring_rule_id) references public.scoring_rules(event_id, id) on delete set null;
alter table public.device_event_access drop constraint device_event_access_event_id_access_code_id_fkey,
  add constraint device_event_access_event_id_access_code_id_fkey foreign key (event_id, access_code_id) references public.event_access_codes(event_id, id) on delete set null;
alter table public.result_submissions drop constraint result_submissions_resolution_request_id_fkey,
  add constraint result_submissions_resolution_request_id_fkey foreign key (resolution_request_id) references public.result_submissions(request_id) on delete set null;

commit;
