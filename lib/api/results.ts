import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Json, Tables } from '@/lib/database.types';
import type { ResultPayload } from '@/lib/station/types';

/**
 * Datenzugriffe für das Modul "Ergebnisse & Tabelle": Abgabejournal,
 * Revisionshistorie, Organisatorkorrektur/-klärung und die berechnete
 * Tabelle. Siehe docs/datenkonzept.md Abschnitt 4, 5, 8.2 und 11.
 */

export type ResultSubmissionRow = Tables<'result_submissions'> & {
  devices: { label: string } | null;
};

const submissionsKey = (eventId: string) => ['events', eventId, 'result-submissions'] as const;

export function useResultSubmissions(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? submissionsKey(eventId) : ['events', 'none', 'result-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('result_submissions')
        .select('*, devices(label)')
        .eq('event_id', eventId as string)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResultSubmissionRow[];
    },
    enabled: Boolean(eventId),
  });
}

export type ResultRevisionRow = Tables<'result_revisions'> & {
  result_values: Tables<'result_values'>[];
};

const revisionsKey = (eventId: string) => ['events', eventId, 'result-revisions'] as const;

export function useResultRevisions(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? revisionsKey(eventId) : ['events', 'none', 'result-revisions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('result_revisions')
        .select('*, result_values(*)')
        .eq('event_id', eventId as string)
        .order('version', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ResultRevisionRow[];
    },
    enabled: Boolean(eventId),
  });
}

export type StandingsRow = Tables<'standings'>;

const standingsKey = (eventId: string) => ['events', eventId, 'standings'] as const;

export function useStandings(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? standingsKey(eventId) : ['events', 'none', 'standings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('standings')
        .select('*')
        .eq('event_id', eventId as string)
        .order('rank', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StandingsRow[];
    },
    enabled: Boolean(eventId),
  });
}

export type ResultPointRow = Tables<'result_points'>;

const resultPointsKey = (eventId: string) => ['events', eventId, 'result-points'] as const;

/** Punkte je Match und Team — für die Aufschlüsselung hinter einem Tabellenplatz. */
export function useResultPoints(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? resultPointsKey(eventId) : ['events', 'none', 'result-points'],
    queryFn: async () => {
      const { data, error } = await supabase.from('result_points').select('*').eq('event_id', eventId as string);
      if (error) throw error;
      return (data ?? []) as ResultPointRow[];
    },
    enabled: Boolean(eventId),
  });
}

function invalidateResults(queryClient: ReturnType<typeof useQueryClient>, eventId: string) {
  void queryClient.invalidateQueries({ queryKey: submissionsKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: revisionsKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: standingsKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: resultPointsKey(eventId) });
  void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'matches'] });
  void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'current-result-values'] });
  void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'open-submissions'] });
  void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'reconciliation'] });
}

/**
 * Organisatorkorrektur mit Pflichtbegründung: schreibt eine neue Revision
 * und kann dabei zugleich offene Abgaben als geklärt markieren
 * (`resolves`), z. B. wenn eine Korrektur einen Konflikt löst.
 */
export function useRecordResult(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      matchId: string;
      baseResultVersion: number;
      payload: ResultPayload;
      reason: string;
      resolves?: string[];
    }) => {
      const { data, error } = await supabase.rpc('organizer_record_result', {
        p_event_id: eventId,
        p_match_id: input.matchId,
        p_base_result_version: input.baseResultVersion,
        p_payload: input.payload as unknown as Json,
        p_reason: input.reason,
        p_resolves: input.resolves ?? [],
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    onSuccess: () => invalidateResults(queryClient, eventId),
  });
}
/** Abgabe ohne neue Revision klären: identisch mit dem aktuellen Stand, oder verworfen. */
export function useDismissSubmissions(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requestIds: string[]; reason: string }) => {
      const { error } = await supabase.rpc('dismiss_submissions', {
        p_event_id: eventId,
        p_request_ids: input.requestIds,
        p_reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateResults(queryClient, eventId),
  });
}

/**
 * Ergebnis weich löschen: leere Revision mit Pflichtbegründung. Das Match wird
 * wieder geöffnet und zählt nicht mehr, die Historie bleibt erhalten.
 */
export function useWithdrawResult(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { matchId: string; reason: string }) => {
      const { error } = await supabase.rpc('withdraw_result', {
        p_event_id: eventId,
        p_match_id: input.matchId,
        p_reason: input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateResults(queryClient, eventId),
  });
}

/**
 * Live-Aktualisierung: ein Signal auf Matches, Abgaben oder Revisionen
 * invalidiert die betroffenen Abfragen, statt selbst UI-State zu führen
 * (docs/datenkonzept.md Abschnitt 11.6).
 */
export function useResultsRealtime(eventId: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!eventId) return;
    const invalidate = () => invalidateResults(queryClient, eventId);
    const channel = supabase
      .channel(`results-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'result_submissions', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'result_revisions', filter: `event_id=eq.${eventId}` }, invalidate)
      .subscribe();
    const fallback = setInterval(invalidate, 60_000);
    return () => {
      clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);
}
