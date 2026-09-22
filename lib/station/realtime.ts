import { supabase } from '@/lib/supabase';

/**
 * Abonniert Matches und Ergebnisrevisionen eines Events. Jedes Signal löst
 * beim Aufrufer einen Paket-Refresh aus; ein Reconnect erzwingt einen
 * vollständigen Neuabruf (docs/datenkonzept.md Abschnitt 11.6).
 */
export function subscribeStationRealtime(eventId: string, onChange: () => void) {
  const channel = supabase
    .channel(`station-${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'result_revisions', filter: `event_id=eq.${eventId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'station_checkins', filter: `event_id=eq.${eventId}` }, onChange)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onChange();
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
