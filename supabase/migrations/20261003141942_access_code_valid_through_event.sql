-- Der Veranstaltungscode galt standardmäßig 30 Tage ab Erzeugung (auch beim
-- automatischen Code aus publish_event). Wurde ein Event Monate vorher
-- veröffentlicht, lief der Code vor dem Spieltag ab: Ein Gerät, das erst am
-- Morgen beitreten wollte, bekam "Code ungültig". Jetzt gilt der Standard
-- mindestens bis zum Ende des zweiten Tags nach dem Veranstaltungstag (in der
-- Zeitzone des Events). Aktive Codes kommender Events werden entsprechend
-- verlängert; ein ausdrücklich übergebenes p_valid_until gilt unverändert.
create or replace function public.rotate_access_code(p_event_id uuid, p_valid_until timestamp with time zone default null)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_code text;
  v_digest text;
  v_attempt integer := 0;
  v_default timestamptz;
begin
  if not private.is_event_organizer(p_event_id) then
    raise exception 'organizer membership required';
  end if;

  select greatest(now() + interval '30 days', ((e.event_date + 3)::timestamp at time zone e.timezone))
    into v_default
  from public.events e where e.id = p_event_id;

  update public.event_access_codes
  set revoked_at = now()
  where event_id = p_event_id and revoked_at is null;

  loop
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    v_digest := private.access_code_digest(v_code);
    begin
      insert into public.event_access_codes(event_id, code_digest, valid_until)
      values (p_event_id, v_digest, coalesce(p_valid_until, v_default));
      exit;
    exception when unique_violation then
      if v_attempt > 20 then
        raise exception 'could not generate a unique access code, try again';
      end if;
    end;
  end loop;

  return v_code;
end;
$function$;

update public.event_access_codes c
set valid_until = ((e.event_date + 3)::timestamp at time zone e.timezone)
from public.events e
where e.id = c.event_id
  and c.revoked_at is null
  and c.valid_until < ((e.event_date + 3)::timestamp at time zone e.timezone);
