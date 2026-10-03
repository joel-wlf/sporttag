import { useEffect, useState } from 'react';
import { loadLocalMap, syncMapAsset, type LocalMap } from './mapAsset';

export type OfflineMapState = { status: 'loading' | 'ready' | 'none'; local: LocalMap | null };

/**
 * Liefert sofort die lokal gespeicherte Karte und gleicht im Hintergrund mit
 * dem Server ab. Ohne Netz bleibt die lokale Karte stehen.
 */
export function useOfflineMap(eventId: string | undefined): OfflineMapState {
  const [state, setState] = useState<OfflineMapState>({ status: 'loading', local: null });

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    void (async () => {
      const local = await loadLocalMap(eventId);
      if (cancelled) return;
      if (local) setState({ status: 'ready', local });
      try {
        const fresh = await syncMapAsset(eventId);
        if (!cancelled) setState({ status: fresh ? 'ready' : 'none', local: fresh });
      } catch {
        if (!cancelled) setState({ status: local ? 'ready' : 'none', local });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return state;
}
