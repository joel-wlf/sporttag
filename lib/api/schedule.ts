import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';
import type { LayoutRow, ProposedCell } from '@/lib/schedule/matrix';

export type BlockRow = Tables<'blocks'>;

export const blockKindLabels: Record<BlockRow['kind'], string> = {
  play: 'Spielblock',
  break: 'Pause',
  final: 'Abschluss',
  special: 'Besonders',
};

export function blockLabel(block: BlockRow): string {
  return `${blockKindLabels[block.kind] ?? block.kind} ${block.position}`;
}

export type RoundRow = Tables<'rounds'>;

export const roundKindLabels: Record<RoundRow['kind'], string> = {
  play: 'Spielrunde',
  break: 'Pause',
};

export function roundLabel(round: RoundRow): string {
  return `${roundKindLabels[round.kind] ?? round.kind} ${round.position}`;
}

export type StationSetupRow = Tables<'station_setups'>;
export type MatchRow = Tables<'matches'>;
export type MatchParticipantRow = Tables<'match_participants'>;

const blocksKey = (eventId: string) => ['events', eventId, 'blocks'] as const;
const roundsKey = (eventId: string) => ['events', eventId, 'rounds'] as const;
const setupsKey = (eventId: string) => ['events', eventId, 'station-setups'] as const;
const matchesKey = (eventId: string) => ['events', eventId, 'matches'] as const;
const participantsKey = (eventId: string) => ['events', eventId, 'match-participants'] as const;

function invalidateSchedule(queryClient: ReturnType<typeof useQueryClient>, eventId: string) {
  void queryClient.invalidateQueries({ queryKey: blocksKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: roundsKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: setupsKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: matchesKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: participantsKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'readiness'] });
}

// ---- Blöcke ----
export function useBlocks(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? blocksKey(eventId) : ['events', 'none', 'blocks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('blocks').select('*').eq('event_id', eventId as string).order('position');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useUpsertBlock(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (block: { id?: string } & Omit<TablesInsert<'blocks'>, 'event_id'>) => {
      if (block.id) {
        const { id, ...patch } = block;
        const { data, error } = await supabase.from('blocks').update(patch as TablesUpdate<'blocks'>).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('blocks').insert({ ...block, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

export function useDeleteBlock(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockId: string) => {
      const { error } = await supabase.from('blocks').delete().eq('id', blockId);
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

// ---- Runden ----
export function useRounds(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? roundsKey(eventId) : ['events', 'none', 'rounds'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rounds').select('*').eq('event_id', eventId as string).order('position');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useUpsertRound(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (round: { id?: string } & Omit<TablesInsert<'rounds'>, 'event_id'>) => {
      if (round.id) {
        const { id, ...patch } = round;
        const { data, error } = await supabase.from('rounds').update(patch as TablesUpdate<'rounds'>).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('rounds').insert({ ...round, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

export function useDeleteRound(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roundId: string) => {
      const { error } = await supabase.from('rounds').delete().eq('id', roundId);
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

// ---- Stationsbelegungen (Station × Block -> Spiel) ----
export function useStationSetups(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? setupsKey(eventId) : ['events', 'none', 'station-setups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('station_setups').select('*').eq('event_id', eventId as string);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useUpsertStationSetup(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (setup: { id?: string } & Omit<TablesInsert<'station_setups'>, 'event_id'>) => {
      if (setup.id) {
        const { id, ...patch } = setup;
        const { data, error } = await supabase.from('station_setups').update(patch as TablesUpdate<'station_setups'>).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('station_setups').insert({ ...setup, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

export function useDeleteStationSetup(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (setupId: string) => {
      const { error } = await supabase.from('station_setups').delete().eq('id', setupId);
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

// ---- Matches ----
export function useMatches(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? matchesKey(eventId) : ['events', 'none', 'matches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*').eq('event_id', eventId as string);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useCreateMatch(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (match: Omit<TablesInsert<'matches'>, 'event_id'>) => {
      const { data, error } = await supabase.from('matches').insert({ ...match, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

export function useUpdateMatch(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & TablesUpdate<'matches'>) => {
      const { id, ...patch } = input;
      const { data, error } = await supabase.from('matches').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

export function useDeleteMatch(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.from('matches').delete().eq('id', matchId);
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

// ---- Matchteilnahmen ----
export function useMatchParticipants(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? participantsKey(eventId) : ['events', 'none', 'match-participants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('match_participants').select('*').eq('event_id', eventId as string);
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useAddMatchParticipant(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { matchId: string; teamId: string; slot: number }) => {
      const { data, error } = await supabase
        .from('match_participants')
        .insert({ event_id: eventId, match_id: input.matchId, team_id: input.teamId, slot: input.slot })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

export function useRemoveMatchParticipant(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase.from('match_participants').delete().eq('id', participantId);
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

// ---- Planungsmatrix ----
export type ScheduleSettings = {
  schedule_start_time: string;
  round_minutes: number;
  changeover_minutes: number;
  break_minutes: number;
};

export function useApplyLayout(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { rows: LayoutRow[]; settings?: Partial<ScheduleSettings> }) => {
      const { error } = await supabase.rpc('schedule_apply_layout', {
        p_event_id: eventId,
        p_rows: input.rows as unknown as Json,
        p_settings: (input.settings ?? null) as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      invalidateSchedule(queryClient, eventId);
      if (input.settings) void queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useSetBlockGame(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { blockId: string; stationId: string; gameId: string | null }) => {
      const { error } = await supabase.rpc('schedule_set_block_game', {
        p_block_id: input.blockId,
        p_station_id: input.stationId,
        p_event_game_id: input.gameId as string,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}

export function useSetCells(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cells: ProposedCell[]) => {
      const { error } = await supabase.rpc('schedule_set_cells', {
        p_event_id: eventId,
        p_cells: cells.map((c) => ({ round_id: c.roundId, station_id: c.stationId, team_ids: c.teamIds })) as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateSchedule(queryClient, eventId),
  });
}
