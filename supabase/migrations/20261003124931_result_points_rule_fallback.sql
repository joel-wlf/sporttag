-- Matches, die nach der Veröffentlichung angelegt werden (schedule_set_cells,
-- Zeitplan im Backoffice), erhalten keine aufgelöste Wertungsregel:
-- `matches.scoring_rule_id` setzt nur `publish_event`. `result_points` verband
-- bisher hart über `m.scoring_rule_id`; solche Matches zählten deshalb nie in
-- der Tabelle, obwohl ihr Ergebnis angenommen war. Jetzt gilt dieselbe
-- Auflösung wie beim Veröffentlichen (datenkonzept.md 8.1):
-- Match ?? Spiel ?? Event-Default.
create or replace view public.result_points with (security_invoker = true) as
select
  m.event_id,
  m.id as match_id,
  crv.team_id,
  crv.version,
  crv.recorded_at,
  crv.placement,
  crv.measured_value,
  sr.mode as rule_mode,
  case
    when sr.mode = 'win_draw_loss' and crv.placement = 1 and winners.winner_count = 1 then (sr.config->>'win')::numeric
    when sr.mode = 'win_draw_loss' and crv.placement = 1 and winners.winner_count > 1 then (sr.config->>'draw')::numeric
    when sr.mode = 'win_draw_loss' then (sr.config->>'loss')::numeric
    when sr.mode = 'placement' then coalesce((sr.config->'points_by_place'->>crv.placement::text)::numeric, (sr.config->>'unlisted_points')::numeric, 0)
    when sr.mode = 'raw_value' then coalesce(crv.measured_value,0) * coalesce((sr.config->>'factor')::numeric,1)
    else 0
  end as points,
  case
    when sr.mode <> 'win_draw_loss' then null
    when crv.placement = 1 and winners.winner_count = 1 then 'win'
    when crv.placement = 1 and winners.winner_count > 1 then 'draw'
    else 'loss'
  end as outcome
from public.matches m
join public.current_result_values crv on crv.match_id = m.id
join public.station_setups ss on ss.id = m.station_setup_id
join public.event_games eg on eg.id = ss.event_game_id
join public.events e on e.id = m.event_id
join public.scoring_rules sr
  on sr.id = coalesce(m.scoring_rule_id, eg.scoring_rule_id, e.default_scoring_rule_id)
left join lateral (
  select count(*)::integer as winner_count from public.current_result_values x
  where x.match_id = crv.match_id and x.placement = 1
) winners on true
where m.status = 'completed' and m.counts_for_ranking;
