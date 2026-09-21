import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert } from '@/lib/database.types';

export type StaffRow = Tables<'event_staff'>;
export type StationAssignmentRow = Tables<'station_assignments'>;

const staffKey = (eventId: string) => ['events', eventId, 'staff'] as const;
const assignmentsKey = (eventId: string) => ['events', eventId, 'assignments'] as const;

export function useEventStaff(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? staffKey(eventId) : ['events', 'none', 'staff'],
    queryFn: async () => {
      const { data, error } = await supabase.from('event_staff').select('*').eq('event_id', eventId as string).order('display_name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useUpsertStaff(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staff: { id?: string } & Omit<TablesInsert<'event_staff'>, 'event_id'>) => {
      if (staff.id) {
        const { id, ...patch } = staff;
        const { data, error } = await supabase.from('event_staff').update(patch).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('event_staff').insert({ ...staff, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKey(eventId) });
    },
  });
}

export function useDeleteStaff(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.from('event_staff').delete().eq('id', staffId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKey(eventId) });
    },
  });
}

export function useStationAssignments(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? assignmentsKey(eventId) : ['events', 'none', 'assignments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_assignments')
        .select('*, event_staff(display_name)')
        .eq('event_id', eventId as string);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useAssignStaff(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { staffId: string; stationSetupId: string }) => {
      const { data, error } = await supabase
        .from('station_assignments')
        .insert({ event_id: eventId, staff_id: input.staffId, station_setup_id: input.stationSetupId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assignmentsKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'readiness'] });
    },
  });
}

export function useUnassignStaff(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from('station_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: assignmentsKey(eventId) });
    },
  });
}
