import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ReadinessIssue } from '@/lib/api/events';

/**
 * Gerätesync-Übersicht und Abschlussabgleich für das Backoffice-Modul
 * "Geräte & Synchronisierung". Siehe docs/datenkonzept.md Abschnitt 11.5.
 */

export type DeviceSyncRow = {
  device_id: string;
  label: string;
  last_seen_at: string | null;
  access_id: string;
  granted_at: string;
  revoked_at: string | null;
  expected: boolean;
  downloaded_plan_version: number | null;
  current_plan_version: number;
  last_reported_sequence: number;
  received_count: number;
  missing_sequences: number[];
  accepted_count: number;
  conflict_count: number;
  needs_review_count: number;
  final_sequence: number | null;
  reconciled_at: string | null;
  active_checkin_station_id: string | null;
  active_checkin_block_id: string | null;
};

const overviewKey = (eventId: string) => ['events', eventId, 'device-sync-overview'] as const;
const reconciliationKey = (eventId: string) => ['events', eventId, 'reconciliation'] as const;

export function useDeviceSyncOverview(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? overviewKey(eventId) : ['events', 'none', 'device-sync-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('device_sync_overview', { p_event_id: eventId as string });
      if (error) throw error;
      return (data ?? []) as DeviceSyncRow[];
    },
    enabled: Boolean(eventId),
  });
}

export function useSetDeviceExpected(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { deviceId: string; expected: boolean }) => {
      const { error } = await supabase.rpc('set_device_expected', {
        p_event_id: eventId,
        p_device_id: input.deviceId,
        p_expected: input.expected,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: overviewKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: reconciliationKey(eventId) });
    },
  });
}

export function useEventReconciliation(eventId: string | null) {
  return useQuery({
    queryKey: eventId ? reconciliationKey(eventId) : ['events', 'none', 'reconciliation'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('check_event_reconciliation', { p_event_id: eventId as string });
      if (error) throw error;
      return (data ?? []) as unknown as ReadinessIssue[];
    },
    enabled: Boolean(eventId),
  });
}

export function useConfirmReconciliation(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('confirm_event_reconciliation', { p_event_id: eventId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reconciliationKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: ['events', eventId] });
    },
  });
}

/**
 * Live-Aktualisierung: ein Signal auf Gerätezustand, Check-ins, Zugang oder
 * Abgaben invalidiert die Übersicht, statt selbst UI-State zu führen.
 */
export function useDevicesRealtime(eventId: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!eventId) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: overviewKey(eventId) });
      void queryClient.invalidateQueries({ queryKey: reconciliationKey(eventId) });
    };
    const channel = supabase
      .channel(`devices-${eventId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_device_states', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'result_submissions', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_checkins', filter: `event_id=eq.${eventId}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'device_event_access', filter: `event_id=eq.${eventId}` }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, queryClient]);
}
