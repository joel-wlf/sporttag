-- Blocks are identified by kind + position in the UI; no separate name is needed.
alter table public.blocks
  drop constraint if exists blocks_name_check;

alter table public.blocks
  alter column name drop not null;
