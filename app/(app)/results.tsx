import { Text, View } from 'react-native';
import { BackofficePage, backofficeStyles as styles, SurfaceCard } from '@/components/backoffice/BackofficePage';
import { palette } from '@/components/ui/theme';
import { useTheme } from '@/hooks/useTheme';
export default function ResultsScreen() { const color = palette(useTheme()); return <BackofficePage title="Ergebnisse" eyebrow="WERTUNG & KLÄRUNG" description="Angenommene Resultate, Konflikte und die daraus berechnete Tabelle bleiben getrennt nachvollziehbar."><View style={styles.grid}>{[['Übertragen', '–'], ['Klärung nötig', '–'], ['Gewertete Matches', '–']].map(([label, value]) => <View key={label} style={styles.cardGrow}><SurfaceCard><Text style={[styles.label, { color: color.muted }]}>{label.toUpperCase()}</Text><Text style={[styles.stat, { color: color.text }]}>{value}</Text></SurfaceCard></View>)}</View></BackofficePage>; }
