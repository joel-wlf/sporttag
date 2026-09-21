import { ModuleScreen } from '@/components/layout/ModuleScreen';

export default function DevicesScreen() {
  return (
    <ModuleScreen
      capabilities={[
        'Registry erwarteter Geräte',
        'Heruntergeladene Planversion je Gerät',
        'Letzter Kontakt und zuletzt gemeldete lokale Sequenz',
        'Ausstehende oder konfliktbehaftete Serverabgaben',
        'Status des finalen Manifests',
        'Fehlende Geräte oder Sequenzlücken',
        'Event erst abgleichen, wenn jede erwartete Quelle erfasst ist',
        'Offline-Backuppakete importieren und prüfen',
        'Gerätezugang widerrufen, getrennt vom Rotieren des Veranstaltungscodes',
      ]}
      description="Erstklassiges Betriebsmodul, weil Offline-Zuverlässigkeit eine Kernanforderung ist. Es zeigt Belege statt vorschnell „alles synchronisiert“."
      eyebrow="OFFLINE"
      title="Geräte & Synchronisierung"
    />
  );
}
