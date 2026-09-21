import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types';

export type ScoringRuleRow = Tables<'scoring_rules'>;
export type EventGameRow = Tables<'event_games'>;
export type ScoringMode = ScoringRuleRow['mode'];

export type WinDrawLossConfig = { win: number; draw: number; loss: number };
export type PlacementConfig = {
  points_by_place: Record<string, number>;
  unlisted_points: number;
  tie_policy?: 'same_place';
};
export type RawValueConfig = { factor: number };

const rulesKey = (eventId: string) => ['events', eventId, 'scoring-rules'] as const;
const gamesKey = (eventId: string) => ['events', eventId, 'games'] as const;

export function useScoringRules(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? rulesKey(eventId) : ['events', 'none', 'scoring-rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('scoring_rules').select('*').eq('event_id', eventId as string).order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useUpsertScoringRule(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rule: { id?: string } & Omit<TablesInsert<'scoring_rules'>, 'event_id'>) => {
      if (rule.id) {
        const { id, ...patch } = rule;
        const { data, error } = await supabase.from('scoring_rules').update(patch as TablesUpdate<'scoring_rules'>).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('scoring_rules').insert({ ...rule, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rulesKey(eventId) });
    },
  });
}

export function useDeleteScoringRule(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from('scoring_rules').delete().eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: rulesKey(eventId) });
    },
  });
}

export function useSetDefaultScoringRule(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from('events').update({ default_scoring_rule_id: ruleId }).eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
  });
}

export function useEventGames(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? gamesKey(eventId) : ['events', 'none', 'games'],
    queryFn: async () => {
      const { data, error } = await supabase.from('event_games').select('*').eq('event_id', eventId as string).order('name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(eventId),
  });
}

export function useUpsertEventGame(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (game: { id?: string } & Omit<TablesInsert<'event_games'>, 'event_id'>) => {
      if (game.id) {
        const { id, ...patch } = game;
        const { data, error } = await supabase.from('event_games').update(patch as TablesUpdate<'event_games'>).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('event_games').insert({ ...game, event_id: eventId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gamesKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'readiness'] });
    },
  });
}

export function useDeleteEventGame(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (gameId: string) => {
      const { error } = await supabase.from('event_games').delete().eq('id', gameId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gamesKey(eventId) });
    },
  });
}

export function useCopyTemplateIntoEvent(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data: template, error: templateError } = await supabase
        .from('game_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (templateError) throw templateError;
      const { id: _id, owner_id: _ownerId, created_at: _createdAt, updated_at: _updatedAt, ...rest } = template;
      const { data, error } = await supabase
        .from('event_games')
        .insert({ ...rest, event_id: eventId, template_id: templateId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gamesKey(eventId) });
    },
  });
}

/** Vorschau: Beispielergebnis -> Tabellenpunkte, rein clientseitig, ohne Serveraufruf. */
export function previewTablePoints(
  mode: ScoringMode,
  config: WinDrawLossConfig | PlacementConfig | RawValueConfig,
  placementOrOutcome: number | 'win' | 'draw' | 'loss',
): number {
  if (mode === 'win_draw_loss') {
    const c = config as WinDrawLossConfig;
    if (placementOrOutcome === 'win') return c.win;
    if (placementOrOutcome === 'draw') return c.draw;
    return c.loss;
  }
  if (mode === 'placement') {
    const c = config as PlacementConfig;
    const place = typeof placementOrOutcome === 'number' ? placementOrOutcome : 1;
    return c.points_by_place[String(place)] ?? c.unlisted_points;
  }
  const c = config as RawValueConfig;
  const value = typeof placementOrOutcome === 'number' ? placementOrOutcome : 0;
  return value * c.factor;
}
