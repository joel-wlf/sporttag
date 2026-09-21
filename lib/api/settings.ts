import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const codeKey = (eventId: string) => ['events', eventId, 'access-code'] as const;
const devicesKey = (eventId: string) => ['events', eventId, 'devices'] as const;
const organizersKey = (eventId: string) => ['events', eventId, 'organizers'] as const;

/** Aktiver Codeeintrag ohne Klartext (Klartext existiert nur einmalig direkt nach dem Erzeugen). */
export function useActiveAccessCode(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? codeKey(eventId) : ['events', 'none', 'access-code'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_access_codes')
        .select('id, valid_until, created_at, revoked_at')
        .eq('event_id', eventId as string)
        .is('revoked_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(eventId),
  });
}

export function useRotateAccessCode(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (validUntil?: string) => {
      const { data, error } = await supabase.rpc('rotate_access_code', {
        p_event_id: eventId,
        p_valid_until: validUntil,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: codeKey(eventId) });
    },
  });
}

export function useRevokeAccessCode(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('revoke_access_code', { p_event_id: eventId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: codeKey(eventId) });
    },
  });
}

export function useEventDevices(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? devicesKey(eventId) : ['events', 'none', 'devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('device_event_access')
        .select('id, granted_at, revoked_at, devices(id, label, last_seen_at)')
        .eq('event_id', eventId as string)
        .order('granted_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useRevokeDeviceAccess(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accessId: string) => {
      const { error } = await supabase.rpc('revoke_device_access', { p_access_id: accessId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: devicesKey(eventId) });
    },
  });
}

export type OrganizerRow = {
  membership_id: string;
  user_id: string;
  display_name: string;
  email: string;
  active: boolean;
};

export function useEventOrganizers(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? organizersKey(eventId) : ['events', 'none', 'organizers'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_event_organizers', { p_event_id: eventId as string });
      if (error) throw error;
      return (data ?? []) as OrganizerRow[];
    },
    enabled: Boolean(eventId),
  });
}

export function useAddEventOrganizer(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.rpc('add_event_organizer', { p_event_id: eventId, p_email: email });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizersKey(eventId) });
    },
  });
}

export function useRemoveEventOrganizer(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: string) => {
      const { error } = await supabase.from('event_memberships').update({ active: false }).eq('id', membershipId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizersKey(eventId) });
    },
  });
}
