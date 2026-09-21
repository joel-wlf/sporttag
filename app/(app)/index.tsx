import { Text, View } from 'react-native';
import { BackofficePage, backofficeStyles as styles, SurfaceCard } from '@/components/backoffice/BackofficePage';
import { palette } from '@/components/ui/theme';
import { useTheme } from '@/hooks/useTheme';

export default function OverviewScreen() {
  const color = palette(useTheme());
  return <BackofficePage description="Planung und Betrieb deiner Veranstaltung." eyebrow="BACKOFFICE" title="Übersicht">
    <View style={styles.grid}>{[['–', 'Teams'], ['–', 'Stationen'], ['–', 'Spiele'], ['Entwurf', 'Planstatus']].map(([value, label]) => <View key={label} style={styles.cardGrow}><SurfaceCard><Text style={[styles.label, { color: color.muted }]}>{label.toUpperCase()}</Text><Text style={[styles.stat, { color: color.text }]}>{value}</Text></SurfaceCard></View>)}</View>
    <View style={styles.grid}>
      <View style={styles.cardWide}><SurfaceCard><Text style={[styles.cardTitle, { color: color.text }]}>Keine Veranstaltung ausgewählt</Text><Text style={[styles.cardDescription, { color: color.muted }]}>Wähle eine Veranstaltung aus oder lege eine neue an.</Text></SurfaceCard></View>
      <View style={styles.cardGrow}><SurfaceCard muted><Text style={[styles.cardTitle, { color: color.text }]}>Nächste Schritte</Text><View style={styles.list}>{['Veranstaltung anlegen', 'Teams und Stationen erfassen', 'Ablauf planen', 'Offline-Paket prüfen'].map((item, index) => <View key={item} style={styles.row}><View style={[styles.badge, { backgroundColor: color.surface }]}><Text style={[styles.badgeText, { color: color.accent }]}>{index + 1}</Text></View><Text style={[styles.rowText, { color: color.text }]}>{item}</Text></View>)}</View></SurfaceCard></View>
    </View>
  </BackofficePage>;
}
