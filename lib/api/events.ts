import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';

export type EventRow = Tables<'events'>;
export type EventStatus = EventRow['status'];

const eventsKey = ['events'] as const;
const eventKey = (eventId: string) => ['events', eventId] as const;
const readinessKey = (eventId: string) => ['events', eventId, 'readiness'] as const;

/** Eigene Events des Organisators, über die aktiven Mitgliedschaften. */
export function useMyEvents() {
  return useQuery({
    queryKey: eventsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_memberships')
        .select('events(*)')
        .eq('active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.events)
        .filter((event): event is EventRow => Boolean(event));
    },
  });
}

export function useEvent(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? eventKey(eventId) : ['events', 'none'],
    queryFn: async () => {
      const { data, error } = await supabase.from('events').select('*').eq('id', eventId as string).single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(eventId),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; eventDate: string; timezone?: string; motto?: string }) => {
      const { data, error } = await supabase.rpc('create_event', {
        p_name: input.name,
        p_event_date: input.eventDate,
        p_timezone: input.timezone ?? 'Europe/Berlin',
        p_motto: input.motto || undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<
        Pick<
          EventRow,
          | 'name'
          | 'motto'
          | 'event_date'
          | 'timezone'
          | 'ntfy_base_url'
          | 'ntfy_topic'
          | 'venue_north'
          | 'venue_south'
          | 'venue_east'
          | 'venue_west'
        >
      >,
    ) => {
      const { data, error } = await supabase.from('events').update(patch).eq('id', eventId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

export function useSetEventStatus(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: EventStatus) => {
      const { data, error } = await supabase.rpc('set_event_status', { p_event_id: eventId, p_status: status });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

export function usePublishEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('publish_event', { p_event_id: eventId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

export function useDeleteDraftEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc('delete_draft_event', { p_event_id: eventId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

export type ReadinessSeverity = 'error' | 'warning';
export type ReadinessIssue = { code: string; severity: ReadinessSeverity; message: string };

export function useEventReadiness(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? readinessKey(eventId) : ['events', 'none', 'readiness'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_event_readiness', { p_event_id: eventId as string });
      if (error) throw error;
      return (data ?? []) as unknown as ReadinessIssue[];
    },
    enabled: Boolean(eventId),
  });
}

export function invalidateEventReadiness(
  queryClient: ReturnType<typeof useQueryClient>,
  eventId: string,
) {
  void queryClient.invalidateQueries({ queryKey: readinessKey(eventId) });
}

export type VenueBounds = { north: number; south: number; east: number; west: number };

/** Liest das Gelände-Rechteck aus einem Event, oder `null`, wenn es noch nicht gesetzt ist. */
export function venueBoundsFromEvent(
  event: Pick<EventRow, 'venue_north' | 'venue_south' | 'venue_east' | 'venue_west'>,
): VenueBounds | null {
  const { venue_north, venue_south, venue_east, venue_west } = event;
  if (venue_north == null || venue_south == null || venue_east == null || venue_west == null) {
    return null;
  }
  return { north: venue_north, south: venue_south, east: venue_east, west: venue_west };
}
