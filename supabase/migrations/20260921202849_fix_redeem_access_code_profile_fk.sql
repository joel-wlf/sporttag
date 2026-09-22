begin;

-- devices.registered_by references profiles(id), aber nicht jeder authentifizierte
-- Nutzer (z.B. rein geraetebasierter Zugang ohne eigenes Organisatorenkonto) hat
-- zwingend eine profiles-Zeile. redeem_access_code setzte bislang direkt
-- auth.uid() ein und verletzte damit die FK, wenn kein Profil existiert.
create or replace function public.redeem_access_code(p_code text, p_device_id uuid, p_device_label text)
returns public.device_event_access
language plpgsql
security definer
set search_path = ''
as $$
declare v_digest text;
declare v_access_code public.event_access_codes;
declare v_access public.device_event_access;
declare v_recent_attempts integer;
declare v_registered_by uuid;
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

  select p.id into v_registered_by from public.profiles p where p.id = (select auth.uid());

  insert into public.devices (id, registered_by, label)
  values (p_device_id, v_registered_by, p_device_label)
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

commit;
