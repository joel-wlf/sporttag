import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tables, TablesUpdate } from '@/lib/database.types';

/**
 * Datenzugriffe für das Modul "Live-Betrieb". Siehe docs/datenkonzept.md
 * Abschnitt 11.6: Realtime ergänzt die persistente Synchronisierung und
 * ersetzt sie nicht; ein Signal löst immer einen vollständigen Neuabruf aus.
 */

export type ActiveCheckinRow = Tables<'station_checkins'> & {
  checkin_staff: { staff_id: string }[];
};

const activeCheckinsKey = (eventId: string) => ['events', eventId, 'active-checkins'] as const;

export function useActiveCheckins(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? activeCheckinsKey(eventId) : ['events', 'none', 'active-checkins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_checkins')
        .select('*, checkin_staff(staff_id)')
        .eq('event_id', eventId as string)
        .is('checked_out_at', null);
      if (error) throw error;
      return (data ?? []) as ActiveCheckinRow[];
    },
    enabled: Boolean(eventId),
  });
}

export type OpenSubmissionRow = {
  request_id: string;
  match_id: string;
  status: string;
  received_at: string;
};

const openSubmissionsKey = (eventId: string) => ['events', eventId, 'open-submissions'] as const;
export function useOpenSubmissions(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? openSubmissionsKey(eventId) : ['events', 'none', 'open-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('result_submissions')
        .select('request_id, match_id, status, received_at')
        .eq('event_id', eventId as string)
        .in('status', ['conflict', 'needs_review']);
      if (error) throw error;
      return (data ?? []) as OpenSubmissionRow[];
    },
    enabled: Boolean(eventId),
  });
}

/**
 * Geteilte Live-Zwischenstände je Match. Sie werden fortlaufend von den
 * Stationsgeräten gemeldet und speisen den mitlaufenden Punktestand sowie den
 * Status "läuft" im Backoffice (docs/datenkonzept.md Abschnitt 11.6).
 */
export type MatchLiveStateRow = Tables<'match_live_states'>;

const matchLiveStatesKey = (eventId: string) => ['events', eventId, 'match-live-states'] as const;

export function useMatchLiveStates(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? matchLiveStatesKey(eventId) : ['events', 'none', 'match-live-states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('match_live_states')
        .select('*')
        .eq('event_id', eventId as string);
      if (error) throw error;
      return (data ?? []) as MatchLiveStateRow[];
    },
    enabled: Boolean(eventId),
  });
}

/**
 * Ein Kanal für alle für den Live-Betrieb relevanten Tabellen. Jedes Signal
 * invalidiert die betroffenen Abfragen; bei (Wieder-)Verbindung erfolgt
 * zusätzlich ein vollständiger Neuabruf, damit verpasste Signale nach einem
 * Verbindungsabbruch keine Datenlücke erzeugen (docs/datenkonzept.md 11.6).
 */
export function useLiveRealtime(eventId: string | null) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    const invalidate = () => {
      setLastUpdated(new Date());
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'matches'] });
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'match-participants'] });
      void queryClient.invalidateQueries({ queryKey: activeCheckinsKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: openSubmissionsKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: currentResultValuesKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: matchLiveStatesKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: teamVisitsKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'device-sync-overview'] });
    };
    const channel = supabase
      .channel(`live-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'result_revisions', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'result_submissions', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_checkins', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_device_states', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_live_states', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_station_visits', filter: `event_id=eq.${eventId}` }, invalidate)
      .subscribe((status) => {
        if (cancelled) return;
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') invalidate();
      });
    // Rückfall, falls Realtime-Signale ausbleiben: alle 60s ein voller Neuabruf.
    const fallback = setInterval(invalidate, 60_000);

    return () => {
      cancelled = true;
      clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);

  return { connected, lastUpdated };
}

export type CurrentResultValueRow = {
  event_id: string;
  match_id: string;
  version: number;
  recorded_at: string;
  participant_id: string;
  team_id: string;
  measured_value: number | null;
  placement: number | null;
};

const currentResultValuesKey = (eventId: string) => ['events', eventId, 'current-result-values'] as const;

/**
 * Aktuell angenommene Ergebniswerte je Team, für den Punktestand auf der
 * Live-Karte. Liest die View `current_result_values` (siehe
 * supabase/migrations/20260921065051…, Abschnitt current_result_version),
 * die nur den jeweils gültigen Stand zeigt, nie den Abgabeverlauf.
 */
export function useCurrentResultValues(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? currentResultValuesKey(eventId) : ['events', 'none', 'current-result-values'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('current_result_values')
        .select('event_id, match_id, version, recorded_at, participant_id, team_id, measured_value, placement')
        .eq('event_id', eventId as string);
      if (error) throw error;
      return (data ?? []) as CurrentResultValueRow[];
    },
    enabled: Boolean(eventId),
  });
}

/**
 * Laufzettel der Gruppen: wann eine Gruppe an einer Station eingetroffen ist
 * und wann sie weitergeschickt wurde. Grundlage der Zeitleiste im Live-Betrieb
 * (docs/datenkonzept.md Abschnitt 11.7).
 */
export type TeamVisitRow = Tables<'team_station_visits'>;

const teamVisitsKey = (eventId: string) => ['events', eventId, 'team-visits'] as const;

export function useTeamVisits(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? teamVisitsKey(eventId) : ['events', 'none', 'team-visits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_station_visits')
        .select('*')
        .eq('event_id', eventId as string);
      if (error) throw error;
      return (data ?? []) as TeamVisitRow[];
    },
    enabled: Boolean(eventId),
  });
}

export type MatchStatus = 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Eingriff aus dem Live-Cockpit: Status setzen und die Begründung mit
 * Zeitstempel an `notes` anhängen, damit ein Eingriff nachvollziehbar
 * bleibt. Start-/Endzeit wird bei Bedarf mitgesetzt.
 */
export function useSetMatchStatus(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { matchId: string; status: MatchStatus; reason: string; notes: string | null }) => {
      const stamp = new Date().toLocaleString('de-DE');
      const entry = `[${stamp}] ${input.reason}`;
      const notes = input.notes ? `${input.notes}\n${entry}` : entry;
      const patch: TablesUpdate<'matches'> = { status: input.status, notes };
      if (input.status === 'in_progress') patch.actual_started_at = new Date().toISOString();
      if (input.status === 'completed') patch.actual_ended_at = new Date().toISOString();
      const { data, error } = await supabase.from('matches').update(patch).eq('id', input.matchId).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['events', eventId, 'matches'] });
    },
  });
}
