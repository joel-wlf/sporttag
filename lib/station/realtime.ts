import { supabase } from '@/lib/supabase';

/**
 * Abonniert Matches, Ergebnisrevisionen, Check-ins, Live-Zwischenstände und
 * den Laufzettel der Gruppen eines Events. Paketrelevante Signale lösen einen
 * vollen Paket-Refresh aus, Live-Zwischenstände und Laufzettel nur einen
 * leichten Refresh (docs/datenkonzept.md 11.6 und 11.7). Ein Reconnect
 * erzwingt jeweils einen vollständigen Neuabruf.
 */
export function subscribeStationRealtime(
  eventId: string,
  handlers: { onPackageChange: () => void; onLiveChange: () => void },
) {
  const channel = supabase
    .channel(`station-${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `event_id=eq.${eventId}` }, handlers.onPackageChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'result_revisions', filter: `event_id=eq.${eventId}` }, handlers.onPackageChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'station_checkins', filter: `event_id=eq.${eventId}` }, handlers.onPackageChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'match_live_states', filter: `event_id=eq.${eventId}` }, handlers.onLiveChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_station_visits', filter: `event_id=eq.${eventId}` }, handlers.onLiveChange)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        handlers.onPackageChange();
        handlers.onLiveChange();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
