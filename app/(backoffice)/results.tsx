import { ModuleScreen } from '@/components/layout/ModuleScreen';

export default function ResultsScreen() {
  return (
    <ModuleScreen
      capabilities={[
        'Match-Ergebnisliste',
        'Aktuell angenommenes Ergebnis',
        'Ursprüngliches Abgabejournal',
        'Revisionshistorie der Ergebnisse',
        'Konfliktvergleich',
        'Organisatorkorrektur mit Pflichtbegründung',
        'Vorläufige und endgültige Tabelle',
        'Aufschlüsselung der Tabellenpunkte je Match',
        'Geteilte Ränge bei Gleichstand',
        'Filter nach Station, Team, Runde und Ergebnisstatus',
      ]}
      description="Operative Ergebnisbearbeitung und berechnete Tabelle. „Eingegangen“, „in die Tabelle angenommen“ und „klärungsbedürftig“ bleiben sichtbar getrennt."
      eyebrow="WERTUNG & KLÄRUNG"
      title="Ergebnisse & Tabelle"
    />
  );
}
