begin;

-- =========================================================================
-- 1. Profile automatisch anlegen
-- =========================================================================
-- `create_event` verlangt eine `profiles`-Zeile. Bisher legt niemand eine an,
-- also scheitert Eventanlage für jeden neuen Organisator. Ein Trigger auf
-- `auth.users` schließt die Lücke; ein zusätzliches clientseitiges Upsert
-- bleibt als Fallback bestehen (siehe lib/api/profile.ts).
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_anonymous then
    return new;
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Organisator'))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- Backfill für bereits existierende, nicht-anonyme Nutzer ohne Profil.
insert into public.profiles (id, display_name)
select u.id, coalesce(nullif(split_part(u.email, '@', 1), ''), 'Organisator')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null and not u.is_anonymous
on conflict (id) do nothing;

-- =========================================================================
-- 2. create_event: legt zusätzlich eine Standard-Wertungsregel an
-- =========================================================================
create or replace function public.create_event(
  p_name text,
  p_event_date date,
  p_timezone text default 'Europe/Berlin',
  p_motto text default null
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_rule public.scoring_rules;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if (select auth.jwt()->>'is_anonymous') = 'true' then
    raise exception 'organizer account required';
  end if;
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid())) then
    insert into public.profiles (id, display_name)
    values ((select auth.uid()), 'Organisator')
    on conflict (id) do nothing;
  end if;

  insert into public.events(name, motto, event_date, timezone)
  values (p_name, p_motto, p_event_date, p_timezone)
  returning * into v_event;

  insert into public.event_memberships(event_id, user_id, role, active)
  values (v_event.id, (select auth.uid()), 'organizer', true);

  insert into public.scoring_rules(event_id, name, mode, config)
  values (v_event.id, 'Standard', 'win_draw_loss', '{"win":3,"draw":1,"loss":0}'::jsonb)
  returning * into v_rule;

  update public.events set default_scoring_rule_id = v_rule.id where id = v_event.id
  returning * into v_event;

  return v_event;
end;
$$;
revoke execute on function public.create_event(text, date, text, text) from public, anon;
grant execute on function public.create_event(text, date, text, text) to authenticated;

-- =========================================================================
-- 3. Statusmaschine
-- =========================================================================
create function private.guard_event_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'draft' and new.status in ('published', 'archived') then
    return new;
  end if;
  if old.status = 'published' and new.status in ('draft', 'running', 'archived') then
    if new.status = 'draft' and exists (
      select 1 from public.result_submissions rs where rs.event_id = old.id
    ) then
      raise exception 'event has submissions, cannot return to draft';
    end if;
    return new;
  end if;
  if old.status = 'running' and new.status in ('finished', 'archived') then
    return new;
  end if;
  if old.status = 'finished' and new.status = 'archived' then
    return new;
  end if;
  raise exception 'invalid event status transition: % -> %', old.status, new.status;
end;
$$;
revoke execute on function private.guard_event_status() from public, anon, authenticated;

create trigger events_guard_status
  before update of status on public.events
  for each row execute function private.guard_event_status();

create function public.set_event_status(p_event_id uuid, p_status text)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare v_event public.events;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  if p_status = 'published' then
    raise exception 'use publish_event() to publish an event';
  end if;
  update public.events set status = p_status where id = p_event_id
  returning * into v_event;
  if v_event.id is null then raise exception 'event not found'; end if;
  return v_event;
end;
$$;
revoke execute on function public.set_event_status(uuid, text) from public, anon;
grant execute on function public.set_event_status(uuid, text) to authenticated;

-- =========================================================================
-- 4. Veröffentlichungsbereitschaft und Freigabe
-- =========================================================================
create function public.check_event_readiness(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_issues jsonb := '[]'::jsonb;
declare v_event public.events;
begin
  if not private.has_event_access(p_event_id) then
    raise exception 'event access required';
  end if;
  select * into v_event from public.events where id = p_event_id;
  if v_event.id is null then raise exception 'event not found'; end if;

  if v_event.default_scoring_rule_id is null then
    v_issues := v_issues || jsonb_build_object(
      'code', 'missing_default_scoring_rule', 'severity', 'error',
      'message', 'Es ist keine Standard-Wertungsregel gesetzt.');
  end if;

  if (select count(*) from public.teams where event_id = p_event_id) < 2 then
    v_issues := v_issues || jsonb_build_object(
      'code', 'not_enough_teams', 'severity', 'error',
      'message', 'Es sind weniger als zwei Teams angelegt.');
  end if;

  if not exists (select 1 from public.stations where event_id = p_event_id) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'no_stations', 'severity', 'error',
      'message', 'Es ist keine Station angelegt.');
  end if;

  if not exists (
    select 1 from public.rounds r where r.event_id = p_event_id and r.kind = 'play'
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'no_play_rounds', 'severity', 'error',
      'message', 'Es ist keine Spielrunde angelegt.');
  end if;

  -- Spielrunden ohne Match
  if exists (
    select 1 from public.rounds r
    where r.event_id = p_event_id and r.kind = 'play'
      and not exists (
        select 1 from public.matches m
        where m.round_id = r.id and m.status <> 'cancelled'
      )
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'rounds_without_matches', 'severity', 'warning',
      'message', 'Mindestens eine Spielrunde hat kein Match.');
  end if;

  -- win_draw_loss auf Mehrteammatch
  if exists (
    select 1 from public.matches m
    join public.event_games g on g.event_id = m.event_id and g.id = (
      select ss.event_game_id from public.station_setups ss where ss.id = m.station_setup_id
    )
    join public.scoring_rules sr on sr.event_id = m.event_id
      and sr.id = coalesce(m.scoring_rule_id, g.scoring_rule_id, v_event.default_scoring_rule_id)
    where m.event_id = p_event_id and m.status <> 'cancelled' and sr.mode = 'win_draw_loss'
      and (select count(*) from public.match_participants mp where mp.match_id = m.id) > 2
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'win_draw_loss_multi_team', 'severity', 'error',
      'message', 'Ein Mehrteamspiel verwendet die Zweier-Wertungsregel Sieg/Unentschieden/Niederlage.');
  end if;

  -- Teilnehmerzahl außerhalb min/max
  if exists (
    select 1 from public.matches m
    join public.event_games g on g.event_id = m.event_id and g.id = (
      select ss.event_game_id from public.station_setups ss where ss.id = m.station_setup_id
    )
    where m.event_id = p_event_id and m.status <> 'cancelled'
      and (select count(*) from public.match_participants mp where mp.match_id = m.id)
        not between g.min_teams and g.max_teams
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'participant_count_mismatch', 'severity', 'error',
      'message', 'Ein Match hat eine unzulässige Teilnehmerzahl für sein Spiel.');
  end if;

  -- Team doppelt in einer Runde
  if exists (
    select 1 from (
      select m.round_id, mp.team_id, count(*) as c
      from public.match_participants mp
      join public.matches m on m.id = mp.match_id and m.status <> 'cancelled'
      where m.event_id = p_event_id
      group by m.round_id, mp.team_id
    ) dup where dup.c > 1
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'team_double_booked', 'severity', 'error',
      'message', 'Ein Team ist in einer Runde mehrfach eingeplant.');
  end if;

  -- Belegungen ohne Betreuung
  if exists (
    select 1 from public.station_setups ss
    where ss.event_id = p_event_id
      and not exists (
        select 1 from public.station_assignments sa where sa.station_setup_id = ss.id
      )
  ) then
    v_issues := v_issues || jsonb_build_object(
      'code', 'unstaffed_setup', 'severity', 'warning',
      'message', 'Mindestens eine Stationsbelegung hat keine Betreuung.');
  end if;

  if v_event.active_map_id is null then
    v_issues := v_issues || jsonb_build_object(
      'code', 'no_active_map', 'severity', 'warning',
      'message', 'Es ist noch keine Offline-Karte hinterlegt.');
  end if;

  return v_issues;
end;
$$;
revoke execute on function public.check_event_readiness(uuid) from public, anon;
grant execute on function public.check_event_readiness(uuid) to authenticated;

create function public.publish_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare v_event public.events;
declare v_issues jsonb;
declare v_errors jsonb;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then raise exception 'event not found'; end if;
  if v_event.status <> 'draft' then
    raise exception 'only draft events can be published';
  end if;

  v_issues := public.check_event_readiness(p_event_id);
  select jsonb_agg(issue) into v_errors
  from jsonb_array_elements(v_issues) issue
  where issue->>'severity' = 'error';
  if v_errors is not null then
    raise exception 'event is not ready to publish: %', v_errors;
  end if;

  update public.matches m
  set scoring_rule_id = coalesce(
    m.scoring_rule_id,
    (
      select g.scoring_rule_id from public.station_setups ss
      join public.event_games g on g.event_id = ss.event_id and g.id = ss.event_game_id
      where ss.id = m.station_setup_id
    ),
    v_event.default_scoring_rule_id
  )
  where m.event_id = p_event_id and m.status <> 'cancelled';

  update public.events
  set status = 'published', plan_version = plan_version + 1
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;
revoke execute on function public.publish_event(uuid) from public, anon;
grant execute on function public.publish_event(uuid) to authenticated;

-- =========================================================================
-- 5. Planungsintegrität
-- =========================================================================
create function private.guard_block_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('blocks:' || new.event_id::text));
  if exists (
    select 1 from public.blocks b
    where b.event_id = new.event_id and b.id <> new.id
      and (new.starts_at, new.ends_at) overlaps (b.starts_at, b.ends_at)
  ) then
    raise exception 'block overlaps an existing block in this event';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_block_overlap() from public, anon, authenticated;
create trigger blocks_guard_overlap
  before insert or update of starts_at, ends_at on public.blocks
  for each row execute function private.guard_block_overlap();

create function private.guard_round_bounds()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_block public.blocks;
begin
  perform pg_advisory_xact_lock(hashtext('rounds:' || new.block_id::text));
  select * into v_block from public.blocks where id = new.block_id and event_id = new.event_id;
  if v_block.id is null then raise exception 'block not found for round'; end if;
  if new.starts_at < v_block.starts_at or new.ends_at > v_block.ends_at then
    raise exception 'round is not within its block bounds';
  end if;
  if exists (
    select 1 from public.rounds r
    where r.block_id = new.block_id and r.id <> new.id
      and (new.starts_at, new.ends_at) overlaps (r.starts_at, r.ends_at)
  ) then
    raise exception 'round overlaps another round in the same block';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_round_bounds() from public, anon, authenticated;
create trigger rounds_guard_bounds
  before insert or update of starts_at, ends_at, block_id on public.rounds
  for each row execute function private.guard_round_bounds();

create function private.guard_match_block()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_round public.rounds;
declare v_setup public.station_setups;
begin
  select * into v_round from public.rounds where id = new.round_id and event_id = new.event_id;
  if v_round.id is null then raise exception 'round not found for match'; end if;
  if v_round.kind <> 'play' then
    raise exception 'matches cannot be scheduled in a break round';
  end if;
  select * into v_setup from public.station_setups where id = new.station_setup_id and event_id = new.event_id;
  if v_setup.id is null then raise exception 'station setup not found for match'; end if;
  if v_setup.block_id <> v_round.block_id then
    raise exception 'match round and station setup must belong to the same block';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_match_block() from public, anon, authenticated;
create trigger matches_guard_block
  before insert or update of round_id, station_setup_id on public.matches
  for each row execute function private.guard_match_block();

create function private.guard_team_once_per_round()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_round_id uuid;
begin
  select round_id into v_round_id from public.matches where id = new.match_id;
  perform pg_advisory_xact_lock(hashtext('round-teams:' || v_round_id::text));
  if exists (
    select 1 from public.match_participants mp
    join public.matches m on m.id = mp.match_id
    where m.round_id = v_round_id and mp.team_id = new.team_id and mp.id <> new.id
      and m.status <> 'cancelled'
  ) then
    raise exception 'team is already scheduled in this round';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_team_once_per_round() from public, anon, authenticated;
create trigger match_participants_guard_team_once
  before insert or update of team_id, match_id on public.match_participants
  for each row execute function private.guard_team_once_per_round();

-- Ergebnisrelevante Konfiguration nach Veröffentlichung sperren.
create function private.guard_locked_after_publish(p_event_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare v_status text;
begin
  select status into v_status from public.events where id = p_event_id;
  if v_status is distinct from 'draft' then
    raise exception 'event is no longer a draft, this field is locked';
  end if;
end;
$$;
revoke execute on function private.guard_locked_after_publish(uuid) from public, anon, authenticated;

create function private.guard_scoring_rule_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.config is distinct from old.config or new.mode is distinct from old.mode then
    perform private.guard_locked_after_publish(new.event_id);
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_scoring_rule_locked() from public, anon, authenticated;
create trigger scoring_rules_guard_locked
  before update of mode, config on public.scoring_rules
  for each row execute function private.guard_scoring_rule_locked();

create function private.guard_event_game_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.measurement_type is distinct from old.measurement_type
    or new.comparison_direction is distinct from old.comparison_direction
    or new.min_teams is distinct from old.min_teams
    or new.max_teams is distinct from old.max_teams
    or new.allow_ties is distinct from old.allow_ties
    or new.scoring_rule_id is distinct from old.scoring_rule_id
  then
    perform private.guard_locked_after_publish(new.event_id);
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_event_game_locked() from public, anon, authenticated;
create trigger event_games_guard_locked
  before update of measurement_type, comparison_direction, min_teams, max_teams, allow_ties, scoring_rule_id
  on public.event_games
  for each row execute function private.guard_event_game_locked();

create function private.guard_match_participants_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.guard_locked_after_publish(coalesce(new.event_id, old.event_id));
  return coalesce(new, old);
end;
$$;
revoke execute on function private.guard_match_participants_locked() from public, anon, authenticated;
create trigger match_participants_guard_locked
  before insert or update or delete on public.match_participants
  for each row execute function private.guard_match_participants_locked();

-- =========================================================================
-- 6. Veranstaltungscode (serverseitig gehashter Digest über Vault-Secret)
-- =========================================================================
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'event_access_code_pepper') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'event_access_code_pepper');
  end if;
end $$;

create function private.access_code_digest(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(
    extensions.hmac(
      p_code,
      (select decrypted_secret from vault.decrypted_secrets where name = 'event_access_code_pepper'),
      'sha256'
    ),
    'hex'
  );
$$;
revoke execute on function private.access_code_digest(text) from public, anon, authenticated;

create function public.rotate_access_code(p_event_id uuid, p_valid_until timestamptz default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_code text;
declare v_digest text;
declare v_attempt integer := 0;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;

  update public.event_access_codes
  set revoked_at = now()
  where event_id = p_event_id and revoked_at is null;

  loop
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    v_digest := private.access_code_digest(v_code);
    begin
      insert into public.event_access_codes(event_id, code_digest, valid_until)
      values (p_event_id, v_digest, coalesce(p_valid_until, now() + interval '30 days'));
      exit;
    exception when unique_violation then
      if v_attempt > 20 then
        raise exception 'could not generate a unique access code, try again';
      end if;
    end;
  end loop;

  return v_code;
end;
$$;
revoke execute on function public.rotate_access_code(uuid, timestamptz) from public, anon;
grant execute on function public.rotate_access_code(uuid, timestamptz) to authenticated;

create function public.revoke_access_code(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  update public.event_access_codes
  set revoked_at = now()
  where event_id = p_event_id and revoked_at is null;
end;
$$;
revoke execute on function public.revoke_access_code(uuid) from public, anon;
grant execute on function public.revoke_access_code(uuid) to authenticated;

create table private.access_code_attempts (
  auth_user_id uuid not null,
  attempted_at timestamptz not null default now()
);
revoke all on table private.access_code_attempts from public, anon, authenticated;
create index access_code_attempts_user_idx on private.access_code_attempts(auth_user_id, attempted_at);

create function public.redeem_access_code(p_code text, p_device_id uuid, p_device_label text)
returns public.device_event_access
language plpgsql
security definer
set search_path = ''
as $$
declare v_digest text;
declare v_access_code public.event_access_codes;
declare v_access public.device_event_access;
declare v_recent_attempts integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;

  delete from private.access_code_attempts
  where auth_user_id = (select auth.uid()) and attempted_at < now() - interval '10 minutes';

  select count(*) into v_recent_attempts
  from private.access_code_attempts
  where auth_user_id = (select auth.uid());
  if v_recent_attempts >= 10 then
    raise exception 'too many attempts, try again later';
  end if;

  insert into private.access_code_attempts(auth_user_id) values ((select auth.uid()));

  v_digest := private.access_code_digest(p_code);
  select * into v_access_code from public.event_access_codes
  where code_digest = v_digest and revoked_at is null and valid_until > now();
  if v_access_code.id is null then
    raise exception 'invalid or expired access code';
  end if;

  insert into public.devices (id, registered_by, label)
  values (p_device_id, (select auth.uid()), p_device_label)
  on conflict (id) do update set label = excluded.label, updated_at = now();

  update public.device_event_access
  set revoked_at = now()
  where event_id = v_access_code.event_id and device_id = p_device_id and revoked_at is null;

  insert into public.device_event_access(event_id, device_id, auth_user_id, access_code_id)
  values (v_access_code.event_id, p_device_id, (select auth.uid()), v_access_code.id)
  returning * into v_access;

  return v_access;
end;
$$;
revoke execute on function public.redeem_access_code(text, uuid, text) from public, anon;
grant execute on function public.redeem_access_code(text, uuid, text) to authenticated;

create function public.revoke_device_access(p_access_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_event_id uuid;
begin
  select event_id into v_event_id from public.device_event_access where id = p_access_id;
  if v_event_id is null then raise exception 'access grant not found'; end if;
  if not private.is_event_organizer(v_event_id) then
    raise exception 'organizer membership required';
  end if;
  update public.device_event_access set revoked_at = now() where id = p_access_id;
end;
$$;
revoke execute on function public.revoke_device_access(uuid) from public, anon;
grant execute on function public.revoke_device_access(uuid) to authenticated;

-- =========================================================================
-- 7. Organisatoren verwalten
-- =========================================================================
create function public.list_event_organizers(p_event_id uuid)
returns table (membership_id uuid, user_id uuid, display_name text, email text, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select em.id, em.user_id, p.display_name, u.email::text, em.active
  from public.event_memberships em
  join public.profiles p on p.id = em.user_id
  join auth.users u on u.id = em.user_id
  where em.event_id = p_event_id and private.is_event_organizer(p_event_id)
  order by em.created_at;
$$;
revoke execute on function public.list_event_organizers(uuid) from public, anon;
grant execute on function public.list_event_organizers(uuid) to authenticated;

create function public.add_event_organizer(p_event_id uuid, p_email text)
returns public.event_memberships
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid;
declare v_membership public.event_memberships;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  select id into v_user_id from auth.users where lower(email) = lower(p_email) and not is_anonymous;
  if v_user_id is null then
    raise exception 'no organizer account found for this email';
  end if;
  insert into public.event_memberships(event_id, user_id, role, active)
  values (p_event_id, v_user_id, 'organizer', true)
  on conflict (event_id, user_id) do update set active = true
  returning * into v_membership;
  return v_membership;
end;
$$;
revoke execute on function public.add_event_organizer(uuid, text) from public, anon;
grant execute on function public.add_event_organizer(uuid, text) to authenticated;

create function private.guard_last_organizer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare v_event_id uuid;
declare v_active_count integer;
begin
  v_event_id := coalesce(new.event_id, old.event_id);
  if (tg_op = 'DELETE') or (tg_op = 'UPDATE' and new.active = false) then
    select count(*) into v_active_count
    from public.event_memberships
    where event_id = v_event_id and active and id <> old.id;
    if v_active_count = 0 then
      raise exception 'cannot remove the last active organizer';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function private.guard_last_organizer() from public, anon, authenticated;
create trigger memberships_guard_last_organizer
  before update of active or delete on public.event_memberships
  for each row execute function private.guard_last_organizer();

-- =========================================================================
-- 8. Entwurf löschen
-- =========================================================================
create function public.delete_draft_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;
  select status into v_status from public.events where id = p_event_id;
  if v_status is null then raise exception 'event not found'; end if;
  if v_status <> 'draft' then
    raise exception 'only draft events can be deleted';
  end if;
  if exists (select 1 from public.result_submissions where event_id = p_event_id) then
    raise exception 'event has result submissions and cannot be deleted';
  end if;

  delete from public.checkin_staff where event_id = p_event_id;
  delete from public.station_checkins where event_id = p_event_id;
  delete from public.device_event_access where event_id = p_event_id;
  delete from public.event_access_codes where event_id = p_event_id;
  delete from public.result_values where event_id = p_event_id;
  delete from public.result_revisions where event_id = p_event_id;
  delete from public.match_participants where event_id = p_event_id;
  delete from public.matches where event_id = p_event_id;
  delete from public.station_assignments where event_id = p_event_id;
  delete from public.station_setups where event_id = p_event_id;
  delete from public.event_staff where event_id = p_event_id;
  delete from public.rounds where event_id = p_event_id;
  delete from public.blocks where event_id = p_event_id;
  delete from public.event_device_states where event_id = p_event_id;
  delete from public.event_games where event_id = p_event_id;
  delete from public.teams where event_id = p_event_id;
  delete from public.stations where event_id = p_event_id;
  update public.events set active_map_id = null, default_scoring_rule_id = null where id = p_event_id;
  delete from public.event_maps where event_id = p_event_id;
  delete from public.scoring_rules where event_id = p_event_id;
  delete from public.event_memberships where event_id = p_event_id;
  delete from public.events where id = p_event_id;
end;
$$;
revoke execute on function public.delete_draft_event(uuid) from public, anon;
grant execute on function public.delete_draft_event(uuid) to authenticated;

commit;
