import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type TeamRow = Tables<'teams'>;

const teamsKey = (eventId: string) => ['events', eventId, 'teams'] as const;

export function useTeams(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? teamsKey(eventId) : ['events', 'none', 'teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('event_id', eventId as string)
        .order('number', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useUpsertTeam(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (team: { id?: string } & Omit<TablesInsert<'teams'>, 'event_id'>) => {
      if (team.id) {
        const { id, ...patch } = team;
        const { data, error } = await supabase.from('teams').update(patch as TablesUpdate<'teams'>).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('teams').insert({ ...team, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(eventId) });
    },
  });
}

export function useDeleteTeam(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(eventId) });
    },
  });
}

/** Legt mehrere durchnummerierte Teams auf einmal an, z. B. "Team 1".."Team 8". */
export function useCreateTeamBatch(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { count: number; prefix: string; startNumber: number }) => {
      const rows: TablesInsert<'teams'>[] = Array.from({ length: input.count }, (_, i) => ({
        event_id: eventId,
        name: `${input.prefix} ${input.startNumber + i}`,
        number: input.startNumber + i,
      }));
      const { data, error } = await supabase.from('teams').insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: teamsKey(eventId) });
    },
  });
}
