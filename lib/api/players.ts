import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/lib/database.types';
import type { BalancePlayer, Gender } from '@/lib/teams/balance';

/**
 * Spieler der Teamzusammenstellung. `players` (Name, Team, fixiert) ist auch
 * für Stationsgeräte lesbar; `player_attributes` (Geschlecht, Stärke, Alter,
 * Notiz) nur für Organisatoren. Siehe docs/datenkonzept.md Abschnitt 8.8.
 */

export type PlayerAttributes = Pick<Tables<'player_attributes'>, 'gender' | 'skill' | 'age' | 'notes'>;

export type Player = Tables<'players'> & {
  gender: Gender | null;
  skill: number | null;
  age: number | null;
  notes: string | null;
};

export type PlayerInput = {
  id?: string;
  name: string;
  team_id: string | null;
  locked: boolean;
  gender: Gender | null;
  skill: number | null;
  age: number | null;
  notes: string | null;
};

export const playersKey = (eventId: string) => ['events', eventId, 'players'] as const;

type PlayerRowWithAttributes = Tables<'players'> & {
  player_attributes: PlayerAttributes | PlayerAttributes[] | null;
};

function flatten(row: PlayerRowWithAttributes): Player {
  const { player_attributes: raw, ...player } = row;
  const attrs = Array.isArray(raw) ? (raw[0] ?? null) : raw;
  return {
    ...player,
    gender: (attrs?.gender as Gender | null) ?? null,
    skill: attrs?.skill ?? null,
    age: attrs?.age ?? null,
    notes: attrs?.notes ?? null,
  };
}

export function toBalancePlayer(p: Player): BalancePlayer {
  return { id: p.id, name: p.name, teamId: p.team_id, locked: p.locked, gender: p.gender, skill: p.skill, age: p.age };
}

export function usePlayers(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? playersKey(eventId) : ['events', 'none', 'players'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*, player_attributes(gender, skill, age, notes)')
        .eq('event_id', eventId as string)
        .order('name', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as PlayerRowWithAttributes[]).map(flatten);
    },
    enabled: Boolean(eventId),
  });
}

function attributesRow(eventId: string, playerId: string, input: PlayerInput) {
  return {
    player_id: playerId,
    event_id: eventId,
    gender: input.gender,
    skill: input.skill,
    age: input.age,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}

export function useUpsertPlayer(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PlayerInput) => {
      const base = { name: input.name.trim(), team_id: input.team_id, locked: input.locked };
      let playerId = input.id;
      if (playerId) {
        const { error } = await supabase.from('players').update(base).eq('id', playerId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('players')
          .insert({ ...base, event_id: eventId })
          .select('id')
          .single();
        if (error) throw error;
        playerId = data.id;
      }
      const { error } = await supabase
        .from('player_attributes')
        .upsert(attributesRow(eventId, playerId, input), { onConflict: 'player_id' });
      if (error) throw error;
      return playerId;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: playersKey(eventId) });
    },
  });
}

export function useDeletePlayer(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (playerId: string) => {
      const { error } = await supabase.from('players').delete().eq('id', playerId);
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: playersKey(eventId) });
    },
  });
}

/** Legt viele Spieler auf einmal an (CSV-Import). */
export function useImportPlayers(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Omit<PlayerInput, 'id' | 'locked' | 'notes'>[]) => {
      if (rows.length === 0) return 0;
      // IDs vorab erzeugen, damit die Attribute unabhängig von der
      // Rückgabereihenfolge eindeutig dem richtigen Spieler zugeordnet werden.
      const withIds = rows.map((r) => ({ id: Crypto.randomUUID(), input: r }));
      const { error } = await supabase
        .from('players')
        .insert(withIds.map(({ id, input }) => ({ id, event_id: eventId, name: input.name.trim(), team_id: input.team_id })));
      if (error) throw error;
      const attributes = withIds
        .filter(({ input }) => input.gender != null || input.skill != null || input.age != null)
        .map(({ id, input }) => attributesRow(eventId, id, { ...input, locked: false, notes: null }));
      if (attributes.length > 0) {
        const { error: attrError } = await supabase.from('player_attributes').insert(attributes);
        if (attrError) throw attrError;
      }
      return withIds.length;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: playersKey(eventId) });
    },
  });
}

/**
 * Verschiebt einen Spieler (Ziehen oder Antippen). Optimistisch im Cache,
 * damit das Board sofort reagiert; bei Fehler wird zurückgerollt.
 */
export function useMovePlayer(eventId: string) {
  const queryClient = useQueryClient();
  const key = playersKey(eventId);
  return useMutation({
    mutationFn: async (input: { playerId: string; teamId?: string | null; locked?: boolean }) => {
      const patch: { team_id?: string | null; locked?: boolean } = {};
      if (input.teamId !== undefined) patch.team_id = input.teamId;
      if (input.locked !== undefined) patch.locked = input.locked;
      const { error } = await supabase.from('players').update(patch).eq('id', input.playerId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Player[]>(key);
      queryClient.setQueryData<Player[]>(key, (list) =>
        list?.map((p) =>
          p.id === input.playerId
            ? {
                ...p,
                team_id: input.teamId !== undefined ? input.teamId : p.team_id,
                locked: input.locked !== undefined ? input.locked : p.locked,
              }
            : p,
        ),
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** Mehrere Zuordnungen atomar setzen (automatische Verteilung, Zurücksetzen). */
export function useSetPlayerTeams(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignments: { playerId: string; teamId: string | null; locked?: boolean }[]) => {
      if (assignments.length === 0) return 0;
      const { data, error } = await supabase.rpc('set_player_teams', {
        p_event_id: eventId,
        p_assignments: assignments.map((a) => ({
          player_id: a.playerId,
          team_id: a.teamId,
          ...(a.locked !== undefined ? { locked: a.locked } : {}),
        })),
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: playersKey(eventId) });
    },
  });
}
