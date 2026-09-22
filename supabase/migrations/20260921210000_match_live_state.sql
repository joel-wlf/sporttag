begin;

-- =========================================================================
-- Live-Zwischenstand und Match-Start vom Stationsgerät.
--
-- Ermöglicht dem Backoffice, ein Match live als "läuft" und den laufenden
-- Punktestand anzuzeigen, ohne die revisionsbasierte Ergebnissicherung
-- (submit_result) zu berühren. Mehrere Geräte derselben Station teilen einen
-- Stand; Aktualisierungen sind idempotent und erzeugen nie einen Konflikt.
-- Siehe docs/datenkonzept.md Abschnitt 11.6.
-- =========================================================================

create table public.match_live_states (
  match_id uuid primary key,
  event_id uuid not null,
  values jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by_device_id uuid,
  unique (event_id, match_id),
  foreign key (event_id, match_id) references public.matches(event_id, id) on delete cascade,
  foreign key (event_id) references public.events(id) on delete cascade,
  foreign key (updated_by_device_id) references public.devices(id) on delete set null
);
create index match_live_states_event_idx on public.match_live_states(event_id);

alter table public.match_live_states enable row level security;

-- Lesen über den Eventzugriff (Organisatoren und Geräte), Schreiben nur über
-- die security-definer-Funktion sync_match_live.
create policy match_live_states_event_select on public.match_live_states
  for select to authenticated using (private.has_event_access(event_id));

revoke all on public.match_live_states from public, anon, authenticated;
grant select on public.match_live_states to authenticated;

-- -------------------------------------------------------------------------
-- sync_match_live: idempotenter Upsert des Live-Stands und optionaler
-- Match-Start. Last-Write-Wins über den vom Gerät gesendeten Zeitstempel,
-- damit sich mehrere Geräte ohne Konflikt auf einen Stand einigen.
-- -------------------------------------------------------------------------
create or replace function public.sync_match_live(
  p_event_id uuid,
  p_match_id uuid,
  p_device_id uuid,
  p_device_access_id uuid,
  p_checkin_id uuid,
  p_values jsonb,
  p_started boolean,
  p_updated_at timestamptz
)
returns public.match_live_states
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_access public.device_event_access;
  v_match public.matches%rowtype;
  v_row public.match_live_states;
  v_client_ts timestamptz := coalesce(p_updated_at, now());
begin
  if (select auth.uid()) is null then raise exception 'authentication required'; end if;
  if p_values is null or jsonb_typeof(p_values) <> 'array' then
    raise exception 'invalid live values';
  end if;

  select * into v_access from public.device_event_access dea
  where dea.id = p_device_access_id and dea.event_id = p_event_id
    and dea.device_id = p_device_id and dea.auth_user_id = (select auth.uid())
    and dea.revoked_at is null;
  if v_access.id is null then raise exception 'device access is not authorized for this event'; end if;

  select * into v_match from public.matches m
  where m.id = p_match_id and m.event_id = p_event_id for update;
  if not found then raise exception 'match not found'; end if;

  if not exists (
    select 1 from public.station_checkins sci
    where sci.id = p_checkin_id and sci.event_id = p_event_id
      and sci.station_setup_id = v_match.station_setup_id
  ) then
    raise exception 'check-in does not match this station setup';
  end if;

  -- Match als laufend markieren, solange es noch nicht begonnen hat. Ein
  -- bereits abgeschlossenes oder abgesagtes Match wird nie reaktiviert.
  if p_started and v_match.status in ('scheduled', 'ready') then
    update public.matches
      set status = 'in_progress',
          actual_started_at = coalesce(actual_started_at, v_client_ts),
          updated_at = now()
    where id = p_match_id;
  end if;

  insert into public.match_live_states (
    match_id, event_id, values, started_at, updated_at, updated_by_device_id
  ) values (
    p_match_id, p_event_id, p_values,
    case when p_started then v_client_ts else null end,
    v_client_ts, p_device_id
  )
  on conflict (match_id) do update set
    values = case
      when excluded.updated_at >= public.match_live_states.updated_at then excluded.values
      else public.match_live_states.values
    end,
    started_at = coalesce(public.match_live_states.started_at, excluded.started_at),
    updated_at = greatest(public.match_live_states.updated_at, excluded.updated_at),
    updated_by_device_id = case
      when excluded.updated_at >= public.match_live_states.updated_at then excluded.updated_by_device_id
      else public.match_live_states.updated_by_device_id
    end
  returning * into v_row;

  return v_row;
end;
$$;
revoke execute on function public.sync_match_live(uuid,uuid,uuid,uuid,uuid,jsonb,boolean,timestamptz) from public, anon;
grant execute on function public.sync_match_live(uuid,uuid,uuid,uuid,uuid,jsonb,boolean,timestamptz) to authenticated;

-- -------------------------------------------------------------------------
-- Realtime für den Live-Stand.
-- -------------------------------------------------------------------------
alter publication supabase_realtime add table public.match_live_states;

commit;
