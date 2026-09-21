begin;

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  motto text,
  event_date date not null,
  timezone text not null default 'Europe/Berlin',
  status text not null default 'draft' check (status in ('draft','published','running','finished','archived')),
  default_scoring_rule_id uuid,
  plan_version integer not null default 1 check (plan_version > 0),
  active_map_id uuid,
  ntfy_base_url text,
  ntfy_topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((ntfy_base_url is null) = (ntfy_topic is null))
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_memberships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  role text not null default 'organizer' check (role = 'organizer'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.game_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  rules text not null default '',
  referee_notes text not null default '',
  materials text not null default '',
  default_duration_seconds integer check (default_duration_seconds > 0),
  measurement_type text not null check (measurement_type in ('outcome','number')),
  unit text,
  comparison_direction text not null check (comparison_direction in ('higher','lower')),
  min_teams integer not null default 2 check (min_teams > 0),
  max_teams integer not null default 2 check (max_teams >= min_teams),
  allow_ties boolean not null default true,
  tools_config jsonb not null default '[]'::jsonb check (jsonb_typeof(tools_config) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  mode text not null check (mode in ('win_draw_loss','raw_value','placement')),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (event_id, name)
);

create table public.event_maps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  version integer not null check (version > 0),
  asset_path text not null check (length(trim(asset_path)) > 0),
  content_hash text not null check (length(content_hash) >= 32),
  mime_type text not null,
  width_px integer not null check (width_px > 0),
  height_px integer not null check (height_px > 0),
  projection text not null default 'EPSG:3857',
  north numeric(9,6) not null check (north between -85.051129 and 85.051129),
  south numeric(9,6) not null check (south between -85.051129 and 85.051129),
  east numeric(10,6) not null check (east between -180 and 180),
  west numeric(10,6) not null check (west between -180 and 180),
  source_label text,
  attribution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (event_id, version),
  check (south < north and west < east)
);

alter table public.events
  add constraint events_default_scoring_rule_fk foreign key (id, default_scoring_rule_id)
    references public.scoring_rules(event_id, id) deferrable initially deferred,
  add constraint events_active_map_fk foreign key (id, active_map_id)
    references public.event_maps(event_id, id) deferrable initially deferred;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  number integer check (number > 0),
  color text,
  participant_count integer check (participant_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (event_id, name),
  unique (event_id, number)
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  location text,
  notes text,
  latitude numeric(9,6) not null check (latitude between -85.051129 and 85.051129),
  longitude numeric(10,6) not null check (longitude between -180 and 180),
  arrival_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (event_id, name)
);

create table public.event_games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  template_id uuid references public.game_templates(id) on delete set null,
  scoring_rule_id uuid,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  rules text not null default '',
  referee_notes text not null default '',
  materials text not null default '',
  default_duration_seconds integer check (default_duration_seconds > 0),
  measurement_type text not null check (measurement_type in ('outcome','number')),
  unit text,
  comparison_direction text not null check (comparison_direction in ('higher','lower')),
  min_teams integer not null default 2 check (min_teams > 0),
  max_teams integer not null default 2 check (max_teams >= min_teams),
  allow_ties boolean not null default true,
  tools_config jsonb not null default '[]'::jsonb check (jsonb_typeof(tools_config) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (event_id, name),
  foreign key (event_id, scoring_rule_id) references public.scoring_rules(event_id, id)
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  kind text not null check (kind in ('play','break','final','special')),
  position integer not null check (position > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (event_id, position),
  check (starts_at < ends_at)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  block_id uuid not null,
  label text not null check (length(trim(label)) > 0),
  position integer not null check (position > 0),
  kind text not null check (kind in ('play','break')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (block_id, position),
  foreign key (event_id, block_id) references public.blocks(event_id, id) on delete restrict,
  check (starts_at < ends_at)
);

create table public.station_setups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  block_id uuid not null,
  station_id uuid not null,
  event_game_id uuid not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  unique (block_id, station_id),
  foreign key (event_id, block_id) references public.blocks(event_id, id) on delete restrict,
  foreign key (event_id, station_id) references public.stations(event_id, id) on delete restrict,
  foreign key (event_id, event_game_id) references public.event_games(event_id, id) on delete restrict
);

create table public.event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  display_name text not null check (length(trim(display_name)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id)
);

create table public.station_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  staff_id uuid not null,
  station_setup_id uuid not null,
  created_at timestamptz not null default now(),
  unique (event_id, id),
  unique (staff_id, station_setup_id),
  foreign key (event_id, staff_id) references public.event_staff(event_id, id) on delete restrict,
  foreign key (event_id, station_setup_id) references public.station_setups(event_id, id) on delete restrict
);

create table public.event_access_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  code_digest text not null unique,
  valid_until timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, id)
);
create unique index event_access_codes_one_active_idx on public.event_access_codes(event_id)
  where revoked_at is null;

create table public.devices (
  id uuid primary key,
  registered_by uuid references public.profiles(id) on delete set null,
  label text not null check (length(trim(label)) > 0),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.device_event_access (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  device_id uuid not null references public.devices(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  access_code_id uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (event_id, id),
  foreign key (event_id, access_code_id) references public.event_access_codes(event_id, id)
);
create unique index device_event_access_one_active_idx on public.device_event_access(event_id, device_id)
  where revoked_at is null;
create index device_event_access_auth_event_idx on public.device_event_access(auth_user_id, event_id)
  where revoked_at is null;

create table public.station_checkins (
  id uuid primary key,
  event_id uuid not null,
  station_setup_id uuid not null,
  device_access_id uuid not null,
  checked_in_at timestamptz not null,
  checked_out_at timestamptz,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, station_setup_id) references public.station_setups(event_id, id) on delete restrict,
  foreign key (event_id, device_access_id) references public.device_event_access(event_id, id) on delete restrict,
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);
create unique index station_checkins_one_active_device_idx on public.station_checkins(event_id, device_access_id)
  where checked_out_at is null;
create index station_checkins_access_setup_idx on public.station_checkins(device_access_id, station_setup_id);

create table public.checkin_staff (
  checkin_id uuid not null,
  staff_id uuid not null,
  event_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (checkin_id, staff_id),
  foreign key (event_id, checkin_id) references public.station_checkins(event_id, id) on delete restrict,
  foreign key (event_id, staff_id) references public.event_staff(event_id, id) on delete restrict
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  round_id uuid not null,
  station_setup_id uuid not null,
  scoring_rule_id uuid,
  status text not null default 'scheduled' check (status in ('scheduled','ready','in_progress','completed','cancelled')),
  counts_for_ranking boolean not null default true,
  notes text,
  current_result_version integer not null default 0 check (current_result_version >= 0),
  actual_started_at timestamptz,
  actual_ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, id),
  foreign key (event_id, round_id) references public.rounds(event_id, id) on delete restrict,
  foreign key (event_id, station_setup_id) references public.station_setups(event_id, id) on delete restrict,
  foreign key (event_id, scoring_rule_id) references public.scoring_rules(event_id, id),
  check (actual_ended_at is null or (actual_started_at is not null and actual_started_at <= actual_ended_at))
);
create unique index matches_one_station_per_round_idx on public.matches(round_id, station_setup_id)
  where status <> 'cancelled';
create index matches_event_round_idx on public.matches(event_id, round_id);
create index matches_setup_round_idx on public.matches(station_setup_id, round_id);

create table public.match_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  match_id uuid not null,
  team_id uuid not null,
  slot integer not null check (slot > 0),
  created_at timestamptz not null default now(),
  unique (event_id, id),
  unique (match_id, team_id),
  unique (match_id, slot),
  foreign key (event_id, match_id) references public.matches(event_id, id) on delete restrict,
  foreign key (event_id, team_id) references public.teams(event_id, id) on delete restrict
);
create index match_participants_team_match_idx on public.match_participants(team_id, match_id);

create table public.event_device_states (
  event_id uuid not null references public.events(id) on delete restrict,
  device_id uuid not null references public.devices(id) on delete restrict,
  downloaded_plan_version integer not null check (downloaded_plan_version > 0),
  last_reported_sequence bigint not null default 0 check (last_reported_sequence >= 0),
  final_sequence bigint check (final_sequence >= 0),
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, device_id)
);

create table public.result_submissions (
  request_id uuid primary key,
  event_id uuid not null,
  match_id uuid not null,
  device_id uuid not null references public.devices(id) on delete restrict,
  submitted_by uuid references public.profiles(id) on delete set null,
  device_access_id uuid,
  checkin_id uuid,
  local_sequence bigint not null check (local_sequence > 0),
  base_result_version integer not null check (base_result_version >= 0),
  plan_version integer not null check (plan_version > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash text not null check (length(payload_hash) >= 32),
  status text not null check (status in ('accepted','conflict','needs_review','resolved')),
  captured_at timestamptz not null,
  received_at timestamptz not null default now(),
  resolution_request_id uuid references public.result_submissions(request_id),
  unique (event_id, request_id),
  unique (event_id, device_id, local_sequence),
  foreign key (event_id, match_id) references public.matches(event_id, id) on delete restrict,
  foreign key (event_id, device_access_id) references public.device_event_access(event_id, id),
  foreign key (event_id, checkin_id) references public.station_checkins(event_id, id),
  check ((submitted_by is not null) <> (device_access_id is not null))
);

create table public.result_revisions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  match_id uuid not null,
  version integer not null check (version > 0),
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now(),
  reason text,
  request_id uuid not null unique,
  unique (event_id, id),
  unique (match_id, version),
  foreign key (event_id, match_id) references public.matches(event_id, id) on delete restrict,
  foreign key (event_id, request_id) references public.result_submissions(event_id, request_id) on delete restrict,
  check (version = 1 or length(trim(reason)) > 0)
);
create index result_revisions_match_version_idx on public.result_revisions(match_id, version desc);

create table public.result_values (
  revision_id uuid not null,
  participant_id uuid not null,
  event_id uuid not null,
  match_id uuid not null,
  measured_value numeric(14,4),
  placement integer check (placement > 0),
  primary key (revision_id, participant_id),
  foreign key (event_id, revision_id) references public.result_revisions(event_id, id) on delete restrict,
  foreign key (event_id, participant_id) references public.match_participants(event_id, id) on delete restrict,
  foreign key (event_id, match_id) references public.matches(event_id, id) on delete restrict,
  check (measured_value is not null or placement is not null)
);

create function private.is_event_organizer(target_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.event_memberships em
    where em.event_id = target_event_id
      and em.user_id = (select auth.uid())
      and em.active
      and em.role = 'organizer'
  );
$$;

create function private.has_event_access(target_event_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select private.is_event_organizer(target_event_id) or exists (
    select 1 from public.device_event_access dea
    where dea.event_id = target_event_id
      and dea.auth_user_id = (select auth.uid())
      and dea.revoked_at is null
  );
$$;

revoke execute on function private.is_event_organizer(uuid) from public, anon;
revoke execute on function private.has_event_access(uuid) from public, anon;
grant execute on function private.is_event_organizer(uuid), private.has_event_access(uuid) to authenticated;

create function public.create_event(
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
declare v_event public.events;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid())) then
    raise exception 'organizer profile required';
  end if;
  insert into public.events(name,motto,event_date,timezone)
  values (p_name,p_motto,p_event_date,p_timezone)
  returning * into v_event;
  insert into public.event_memberships(event_id,user_id,role,active)
  values (v_event.id,(select auth.uid()),'organizer',true);
  return v_event;
end;
$$;
revoke execute on function public.create_event(text,date,text,text) from public, anon;
grant execute on function public.create_event(text,date,text,text) to authenticated;

create function private.guard_result_value_match()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.result_revisions rr
    join public.match_participants mp on mp.id = new.participant_id
    where rr.id = new.revision_id
      and rr.event_id = new.event_id
      and rr.match_id = new.match_id
      and mp.event_id = new.event_id
      and mp.match_id = new.match_id
  ) then
    raise exception 'result value revision and participant must belong to the same match';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_result_value_match() from public, anon, authenticated;
create constraint trigger result_values_match_guard
after insert or update on public.result_values
deferrable initially immediate
for each row execute function private.guard_result_value_match();

create function public.submit_result(
  p_request_id uuid,
  p_event_id uuid,
  p_match_id uuid,
  p_device_id uuid,
  p_device_access_id uuid,
  p_checkin_id uuid,
  p_local_sequence bigint,
  p_base_result_version integer,
  p_plan_version integer,
  p_payload jsonb,
  p_payload_hash text,
  p_captured_at timestamptz,
  p_reason text default null
)
returns table (request_id uuid, payload_hash text, status text, result_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_existing public.result_submissions%rowtype;
  v_revision_id uuid;
  v_version integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload->'values') <> 'array' then
    raise exception 'invalid submission payload';
  end if;

  select * into v_existing from public.result_submissions rs where rs.request_id = p_request_id;
  if found then
    if v_existing.payload_hash <> p_payload_hash or v_existing.payload <> p_payload then
      raise exception 'request_id was already used with different content';
    end if;
    return query select v_existing.request_id, v_existing.payload_hash, v_existing.status,
      (select rr.version from public.result_revisions rr where rr.request_id = p_request_id);
    return;
  end if;

  if not exists (
    select 1 from public.device_event_access dea
    join public.station_checkins sci on sci.id = p_checkin_id
    join public.matches m on m.id = p_match_id
    where dea.id = p_device_access_id and dea.event_id = p_event_id
      and dea.device_id = p_device_id and dea.auth_user_id = (select auth.uid())
      and dea.revoked_at is null and sci.device_access_id = dea.id
      and sci.event_id = p_event_id and sci.station_setup_id = m.station_setup_id
      and m.event_id = p_event_id
  ) then
    raise exception 'device access or check-in is not authorized for this match';
  end if;

  select * into v_match from public.matches m where m.id = p_match_id and m.event_id = p_event_id for update;
  if not found then raise exception 'match not found'; end if;

  insert into public.result_submissions (
    request_id,event_id,match_id,device_id,device_access_id,checkin_id,local_sequence,
    base_result_version,plan_version,payload,payload_hash,status,captured_at
  ) values (
    p_request_id,p_event_id,p_match_id,p_device_id,p_device_access_id,p_checkin_id,p_local_sequence,
    p_base_result_version,p_plan_version,p_payload,p_payload_hash,
    case when v_match.current_result_version = p_base_result_version
      and v_match.status <> 'cancelled'
      and (select e.plan_version from public.events e where e.id = p_event_id) = p_plan_version
      then 'accepted' else 'conflict' end,
    p_captured_at
  );

  if v_match.current_result_version <> p_base_result_version or v_match.status = 'cancelled'
     or (select e.plan_version from public.events e where e.id = p_event_id) <> p_plan_version then
    return query select p_request_id, p_payload_hash, 'conflict'::text, null::integer;
    return;
  end if;

  if (select count(*) from jsonb_array_elements(p_payload->'values')) <>
     (select count(*) from public.match_participants mp where mp.match_id = p_match_id) then
    raise exception 'submission must contain exactly one value per match participant';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload->'values') value
    left join public.match_participants mp
      on mp.id = (value->>'participant_id')::uuid and mp.match_id = p_match_id
    where mp.id is null
  ) then raise exception 'submission contains an invalid participant'; end if;
  if (select count(distinct value->>'participant_id') from jsonb_array_elements(p_payload->'values') value) <>
     (select count(*) from jsonb_array_elements(p_payload->'values')) then
    raise exception 'submission contains duplicate participants';
  end if;

  v_version := v_match.current_result_version + 1;
  insert into public.result_revisions(event_id,match_id,version,reason,request_id)
  values (p_event_id,p_match_id,v_version,p_reason,p_request_id)
  returning id into v_revision_id;

  insert into public.result_values(revision_id,participant_id,event_id,match_id,measured_value,placement)
  select v_revision_id, (value->>'participant_id')::uuid, p_event_id, p_match_id,
    nullif(value->>'measured_value','')::numeric,
    nullif(value->>'placement','')::integer
  from jsonb_array_elements(p_payload->'values') value;

  update public.matches set current_result_version = v_version, status = 'completed', updated_at = now()
  where id = p_match_id;
  update public.event_device_states
    set last_reported_sequence = greatest(last_reported_sequence, p_local_sequence),
        final_sequence = case when final_sequence is not null and p_local_sequence > final_sequence then null else final_sequence end,
        reconciled_at = case when final_sequence is not null and p_local_sequence > final_sequence then null else reconciled_at end,
        updated_at = now()
  where event_id = p_event_id and device_id = p_device_id;

  return query select p_request_id, p_payload_hash, 'accepted'::text, v_version;
end;
$$;
revoke execute on function public.submit_result(uuid,uuid,uuid,uuid,uuid,uuid,bigint,integer,integer,jsonb,text,timestamptz,text) from public, anon;
grant execute on function public.submit_result(uuid,uuid,uuid,uuid,uuid,uuid,bigint,integer,integer,jsonb,text,timestamptz,text) to authenticated;

create view public.current_result_values with (security_invoker = true) as
select rr.event_id, rr.match_id, rr.version, rr.recorded_at, rv.participant_id, mp.team_id,
       rv.measured_value, rv.placement
from public.matches m
join public.result_revisions rr on rr.match_id = m.id and rr.version = m.current_result_version
join public.result_values rv on rv.revision_id = rr.id
join public.match_participants mp on mp.id = rv.participant_id;

create view public.standings with (security_invoker = true) as
select t.event_id, t.id as team_id, t.name as team_name,
  coalesce(sum(case
    when sr.mode = 'win_draw_loss' and crv.placement = 1 and winners.winner_count = 1 then (sr.config->>'win')::numeric
    when sr.mode = 'win_draw_loss' and crv.placement = 1 and winners.winner_count > 1 then (sr.config->>'draw')::numeric
    when sr.mode = 'win_draw_loss' then (sr.config->>'loss')::numeric
    when sr.mode = 'placement' then coalesce((sr.config->'points_by_place'->>crv.placement::text)::numeric, (sr.config->>'unlisted_points')::numeric, 0)
    when sr.mode = 'raw_value' then coalesce(crv.measured_value,0) * coalesce((sr.config->>'factor')::numeric,1)
    else 0 end),0) as table_points,
  max(crv.recorded_at) as last_result_at
from public.teams t
left join public.current_result_values crv on crv.team_id = t.id
left join public.matches m on m.id = crv.match_id and m.status = 'completed' and m.counts_for_ranking
left join public.scoring_rules sr on sr.id = m.scoring_rule_id
left join lateral (
  select count(*)::integer as winner_count from public.current_result_values x
  where x.match_id = crv.match_id and x.placement = 1
) winners on true
group by t.event_id, t.id, t.name;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'events','profiles','event_memberships','game_templates','scoring_rules','event_maps','teams','stations',
    'event_games','blocks','rounds','station_setups','event_staff','station_assignments','event_access_codes',
    'devices','device_event_access','station_checkins','checkin_staff','matches','match_participants',
    'event_device_states','result_submissions','result_revisions','result_values'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

grant select on public.events, public.teams, public.stations, public.scoring_rules, public.event_maps,
  public.event_games, public.blocks, public.rounds, public.station_setups, public.event_staff,
  public.station_assignments, public.matches, public.match_participants, public.result_revisions,
  public.result_values, public.current_result_values, public.standings to authenticated;
grant select on public.profiles, public.event_memberships, public.game_templates, public.devices,
  public.device_event_access, public.station_checkins, public.checkin_staff, public.event_device_states,
  public.result_submissions to authenticated;
grant insert, update, delete on public.events, public.teams, public.stations, public.scoring_rules,
  public.event_maps, public.event_games, public.blocks, public.rounds, public.station_setups,
  public.event_staff, public.station_assignments, public.matches, public.match_participants,
  public.event_device_states to authenticated;
grant insert, update on public.profiles, public.devices, public.station_checkins, public.checkin_staff to authenticated;
grant insert, update, delete on public.game_templates, public.event_memberships, public.event_access_codes,
  public.device_event_access to authenticated;

create policy profiles_self_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_self_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_self_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy templates_owner_all on public.game_templates for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy memberships_event_select on public.event_memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_event_organizer(event_id));
create policy memberships_organizer_insert on public.event_memberships for insert to authenticated with check (private.is_event_organizer(event_id));
create policy memberships_organizer_update on public.event_memberships for update to authenticated using (private.is_event_organizer(event_id)) with check (private.is_event_organizer(event_id));
create policy memberships_organizer_delete on public.event_memberships for delete to authenticated using (private.is_event_organizer(event_id));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'teams','stations','scoring_rules','event_maps','event_games','blocks','rounds','station_setups',
    'event_staff','station_assignments','matches','match_participants','event_device_states'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.has_event_access(event_id))', table_name || '_event_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_event_organizer(event_id))', table_name || '_organizer_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_event_organizer(event_id)) with check (private.is_event_organizer(event_id))', table_name || '_organizer_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_event_organizer(event_id))', table_name || '_organizer_delete', table_name);
  end loop;
end $$;

create policy events_event_select on public.events for select to authenticated using (private.has_event_access(id));
create policy events_organizer_update on public.events for update to authenticated using (private.is_event_organizer(id)) with check (private.is_event_organizer(id));
create policy events_organizer_delete on public.events for delete to authenticated using (private.is_event_organizer(id));

create policy access_codes_organizer_select on public.event_access_codes for select to authenticated using (private.is_event_organizer(event_id));
create policy access_codes_organizer_insert on public.event_access_codes for insert to authenticated with check (private.is_event_organizer(event_id));
create policy access_codes_organizer_update on public.event_access_codes for update to authenticated using (private.is_event_organizer(event_id)) with check (private.is_event_organizer(event_id));
create policy access_codes_organizer_delete on public.event_access_codes for delete to authenticated using (private.is_event_organizer(event_id));
create policy device_access_select on public.device_event_access for select to authenticated using (auth_user_id = (select auth.uid()) or private.is_event_organizer(event_id));
create policy device_access_organizer_write on public.device_event_access for all to authenticated using (private.is_event_organizer(event_id)) with check (private.is_event_organizer(event_id));
create policy devices_select on public.devices for select to authenticated using (registered_by = (select auth.uid()) or exists (select 1 from public.device_event_access dea where dea.device_id = devices.id and (dea.auth_user_id = (select auth.uid()) or private.is_event_organizer(dea.event_id))));
create policy devices_insert on public.devices for insert to authenticated with check (registered_by = (select auth.uid()));
create policy devices_update on public.devices for update to authenticated using (registered_by = (select auth.uid())) with check (registered_by = (select auth.uid()));

create policy checkins_select on public.station_checkins for select to authenticated using (private.has_event_access(event_id));
create policy checkins_device_insert on public.station_checkins for insert to authenticated with check (exists (select 1 from public.device_event_access dea where dea.id = device_access_id and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null));
create policy checkins_device_update on public.station_checkins for update to authenticated using (exists (select 1 from public.device_event_access dea where dea.id = device_access_id and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null)) with check (exists (select 1 from public.device_event_access dea where dea.id = device_access_id and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null));
create policy checkin_staff_select on public.checkin_staff for select to authenticated using (private.has_event_access(event_id));
create policy checkin_staff_device_insert on public.checkin_staff for insert to authenticated with check (exists (select 1 from public.station_checkins sci join public.device_event_access dea on dea.id = sci.device_access_id where sci.id = checkin_id and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null));
create policy checkin_staff_device_update on public.checkin_staff for update to authenticated using (exists (select 1 from public.station_checkins sci join public.device_event_access dea on dea.id = sci.device_access_id where sci.id = checkin_id and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null)) with check (exists (select 1 from public.station_checkins sci join public.device_event_access dea on dea.id = sci.device_access_id where sci.id = checkin_id and dea.auth_user_id = (select auth.uid()) and dea.revoked_at is null));

create policy revisions_event_select on public.result_revisions for select to authenticated using (private.has_event_access(event_id));
create policy values_event_select on public.result_values for select to authenticated using (private.has_event_access(event_id));
create policy submissions_select on public.result_submissions for select to authenticated using (private.is_event_organizer(event_id) or exists (select 1 from public.device_event_access dea where dea.id = device_access_id and dea.auth_user_id = (select auth.uid())));

create trigger events_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger memberships_updated_at before update on public.event_memberships for each row execute function public.set_updated_at();
create trigger game_templates_updated_at before update on public.game_templates for each row execute function public.set_updated_at();
create trigger scoring_rules_updated_at before update on public.scoring_rules for each row execute function public.set_updated_at();
create trigger event_maps_updated_at before update on public.event_maps for each row execute function public.set_updated_at();
create trigger teams_updated_at before update on public.teams for each row execute function public.set_updated_at();
create trigger stations_updated_at before update on public.stations for each row execute function public.set_updated_at();
create trigger event_games_updated_at before update on public.event_games for each row execute function public.set_updated_at();
create trigger blocks_updated_at before update on public.blocks for each row execute function public.set_updated_at();
create trigger rounds_updated_at before update on public.rounds for each row execute function public.set_updated_at();
create trigger station_setups_updated_at before update on public.station_setups for each row execute function public.set_updated_at();
create trigger event_staff_updated_at before update on public.event_staff for each row execute function public.set_updated_at();
create trigger devices_updated_at before update on public.devices for each row execute function public.set_updated_at();
create trigger matches_updated_at before update on public.matches for each row execute function public.set_updated_at();
create trigger device_states_updated_at before update on public.event_device_states for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.result_submissions;
alter publication supabase_realtime add table public.result_revisions;
alter publication supabase_realtime add table public.result_values;

commit;
