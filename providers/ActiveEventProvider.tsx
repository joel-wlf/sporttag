import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useEvent, type EventRow } from '@/lib/api/events';

const STORAGE_KEY = 'sporttag.backoffice.activeEventId';

type ActiveEventContextValue = {
  eventId: string | null;
  event: EventRow | null | undefined;
  isLoading: boolean;
  setActiveEventId: (eventId: string | null) => void;
};

const ActiveEventContext = createContext<ActiveEventContextValue | undefined>(undefined);

export function ActiveEventProvider({ children }: { children: React.ReactNode }) {
  const [storedEventId, setStoredEventId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active) {
        if (stored) setStoredEventId(stored);
        setRestored(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const { data: event, isLoading: eventLoading, isError } = useEvent(storedEventId);

  // Event nicht mehr zugreifbar (gelöscht, Mitgliedschaft entzogen): die
  // gespeicherte Auswahl bleibt bewusst unverändert im State (kein setState
  // hier), nur der abgeleitete `eventId` unten wird null; die veraltete
  // Persistenz wird als reiner Nebeneffekt geräumt.
  useEffect(() => {
    if (restored && storedEventId && isError) {
      void AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, [restored, storedEventId, isError]);

  const eventId = isError ? null : storedEventId;

  const setActiveEventId = (next: string | null) => {
    setStoredEventId(next);
    if (next) void AsyncStorage.setItem(STORAGE_KEY, next);
    else void AsyncStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(
    () => ({
      eventId,
      event: isError ? null : event,
      isLoading: !restored || (Boolean(storedEventId) && eventLoading),
      setActiveEventId,
    }),
    [eventId, event, isError, restored, storedEventId, eventLoading],
  );

  return <ActiveEventContext.Provider value={value}>{children}</ActiveEventContext.Provider>;
}

export function useActiveEvent() {
  const value = useContext(ActiveEventContext);
  if (!value) throw new Error('useActiveEvent must be used within ActiveEventProvider');
  return value;
}
