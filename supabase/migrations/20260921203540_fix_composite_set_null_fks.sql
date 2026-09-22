begin;

-- ON DELETE SET NULL on a composite FK (event_id, x) nulls out ALL of its
-- columns by default, including event_id, which is NOT NULL on these
-- tables. That made deleting a scoring rule (or access code) fail with
-- "null value in column event_id ... violates not-null constraint"
-- instead of just clearing the optional column. Scope SET NULL to the
-- single nullable column.
alter table public.event_games drop constraint event_games_event_id_scoring_rule_id_fkey,
  add constraint event_games_event_id_scoring_rule_id_fkey foreign key (event_id, scoring_rule_id)
    references public.scoring_rules(event_id, id) on delete set null (scoring_rule_id);

alter table public.matches drop constraint matches_event_id_scoring_rule_id_fkey,
  add constraint matches_event_id_scoring_rule_id_fkey foreign key (event_id, scoring_rule_id)
    references public.scoring_rules(event_id, id) on delete set null (scoring_rule_id);

alter table public.device_event_access drop constraint device_event_access_event_id_access_code_id_fkey,
  add constraint device_event_access_event_id_access_code_id_fkey foreign key (event_id, access_code_id)
    references public.event_access_codes(event_id, id) on delete set null (access_code_id);

commit;
