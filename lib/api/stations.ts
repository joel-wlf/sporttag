import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type StationRow = Tables<'stations'>;

const stationsKey = (eventId: string) => ['events', eventId, 'stations'] as const;

export function useStations(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? stationsKey(eventId) : ['events', 'none', 'stations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('stations').select('*').eq('event_id', eventId as string).order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useUpsertStation(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (station: { id?: string } & Omit<TablesInsert<'stations'>, 'event_id'>) => {
      if (station.id) {
        const { id, ...patch } = station;
        const { data, error } = await supabase.from('stations').update(patch as TablesUpdate<'stations'>).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('stations').insert({ ...station, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stationsKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'readiness'] });
    },
  });
}

export function useDeleteStation(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stationId: string) => {
      const { error } = await supabase.from('stations').delete().eq('id', stationId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: stationsKey(eventId) });
    },
  });
}
