import { createContext, useContext, useMemo, useState } from 'react';

type StationSessionValue = {
  staffName: string | null;
  checkedInId: string | null;
  setStaffName: (name: string) => void;
  checkIn: (entryId: string) => void;
  checkOut: () => void;
  leave: () => void;
};

const StationSessionContext = createContext<StationSessionValue | undefined>(undefined);

/**
 * Arbeitskontext eines Stationsgeräts: gewählte Person und aktiver Check-in.
 * Es kann immer nur ein Check-in gleichzeitig aktiv sein; ein neuer beendet
 * den vorherigen. Der Zustand liegt nur im Speicher — es wird nichts dauerhaft
 * gesichert (siehe README, Abschnitt "Tatsächlicher Implementierungsstand").
 */
export function StationSessionProvider({ children }: { children: React.ReactNode }) {
  const [staffName, setStaffName] = useState<string | null>(null);
  const [checkedInId, setCheckedInId] = useState<string | null>(null);

  const value = useMemo<StationSessionValue>(
    () => ({
      staffName,
      checkedInId,
      setStaffName,
      checkIn: (entryId: string) => setCheckedInId(entryId),
      checkOut: () => setCheckedInId(null),
      leave: () => {
        setStaffName(null);
        setCheckedInId(null);
      },
    }),
    [staffName, checkedInId],
  );

  return <StationSessionContext.Provider value={value}>{children}</StationSessionContext.Provider>;
}

export function useStationSession() {
  const value = useContext(StationSessionContext);
  if (!value) throw new Error('useStationSession must be used within StationSessionProvider');
  return value;
}
