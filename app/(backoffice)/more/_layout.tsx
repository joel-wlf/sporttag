import { SectionStack } from '@/components/layout/SectionStack';

// Ein Sprung von außen (z. B. Live → Geräte) legt den Hub darunter, damit
// Zurück dort landet statt auf einer Seite ohne Zurück-Knopf.
export const unstable_settings = { initialRouteName: 'index' };

export default function MoreLayout() {
  return <SectionStack backTitle="Mehr" />;
}
