import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Wie lange der Start höchstens auf `getSession()` wartet. Ist das Token
 * abgelaufen und kein Netz da, versucht supabase-js die Erneuerung bis zu
 * 30 Sekunden lang (bei hängendem WLAN länger) — so lange blieb die ganze
 * App, auch der Offline-Stationsbetrieb, hinter einem Ladekreis.
 */
const SESSION_WAIT_MS = 2500;

/** Gespeicherte Sitzung ohne Erneuerung; reicht für die Routenwahl. */
async function readStoredSession(): Promise<Session | null> {
  try {
    const key = (supabase.auth as unknown as { storageKey?: string }).storageKey;
    if (!key) return null;
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) : await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session | { currentSession?: Session };
    const session = 'access_token' in parsed ? parsed : parsed.currentSession;
    return session?.user ? session : null;
  } catch {
    return null;
  }
}

type SessionContextValue = { session: Session | null; isLoading: boolean };
const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let settled = false;
    const fallback = setTimeout(() => {
      if (settled) return;
      void readStoredSession().then((stored) => {
        if (!active || settled) return;
        setSession(stored);
        setIsLoading(false);
      });
    }, SESSION_WAIT_MS);
    supabase.auth
      .getSession()
      .then(({ data: { session: restored } }) => {
        settled = true;
        if (active) {
          setSession(restored);
          setIsLoading(false);
        }
      })
      // Ohne diesen Zweig bliebe der Ladezustand bei einem Fehler für immer
      // stehen; die App darf nie in einem Endlos-Spinner hängen bleiben.
      .catch(() => {
        settled = true;
        if (active) {
          setSession(null);
          setIsLoading(false);
        }
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      settled = true;
      setSession(nextSession);
      setIsLoading(false);
    });
    return () => {
      active = false;
      clearTimeout(fallback);
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, isLoading }), [session, isLoading]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used within SessionProvider');
  return value;
}
