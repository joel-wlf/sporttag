import { Text, View } from 'react-native';
import { BackofficePage, backofficeStyles as styles, SurfaceCard } from '@/components/backoffice/BackofficePage';
import { palette } from '@/components/ui/theme';
import { useTheme } from '@/hooks/useTheme';
export default function LiveScreen() { const color = palette(useTheme()); return <BackofficePage title="Live-Betrieb" eyebrow="VERANSTALTUNGSTAG" description="Runden, Stationen und Check-ins im Blick."><View style={styles.grid}><View style={styles.cardWide}><SurfaceCard><Text style={[styles.cardTitle, { color: color.text }]}>Keine laufende Veranstaltung</Text></SurfaceCard></View><View style={styles.cardGrow}><SurfaceCard muted><Text style={[styles.label, { color: color.muted }]}>DATENSTAND</Text><Text style={[styles.stat, { color: color.text }]}>–</Text></SurfaceCard></View></View></BackofficePage>; }
