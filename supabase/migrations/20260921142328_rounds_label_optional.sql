-- Rounds are identified by kind + position in the UI; no separate label is needed.
alter table public.rounds
  drop constraint if exists rounds_label_check;

alter table public.rounds
  alter column label drop not null;
