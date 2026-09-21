import { ModuleScreen } from '@/components/layout/ModuleScreen';

export default function LiveScreen() {
  return (
    <ModuleScreen
      capabilities={[
        'Aktuelle und kommende Runden',
        'Matchstatus je Station',
        'Tatsächliche Check-ins und angegebene anwesende Betreuung',
        'Letzter Aktualisierungszeitpunkt und Datenvollständigkeit',
        'Eingehende ntfy-Hilfeanfragen bzw. Zustellversuche',
        'Schnellzugriff auf verspätete, fehlende oder abgesagte Matches',
        'Klare Trennung zwischen Live-Serverwissen und möglicherweise offline befindlichen Geräten',
      ]}
      description="Cockpit am Veranstaltungstag. Die Ansicht darf nie vollständiges Live-Wissen behaupten, solange Geräte offline sind."
      eyebrow="VERANSTALTUNGSTAG"
      title="Live-Betrieb"
    />
  );
}
