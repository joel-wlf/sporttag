import { Text, View } from 'react-native';
import { BackofficePage, backofficeStyles as styles, SurfaceCard } from '@/components/backoffice/BackofficePage';
import { palette } from '@/components/ui/theme';
import { useTheme } from '@/hooks/useTheme';
export default function DevicesScreen() { const color = palette(useTheme()); return <BackofficePage title="Geräte & Synchronisierung" eyebrow="OFFLINE" description="Geräte, Planstände und Abgleichstatus."><View style={styles.grid}><View style={styles.cardWide}><SurfaceCard><Text style={[styles.cardTitle, { color: color.text }]}>Keine Geräte registriert</Text></SurfaceCard></View><View style={styles.cardGrow}><SurfaceCard muted><Text style={[styles.label, { color: color.muted }]}>ABGLEICHSTATUS</Text><Text style={[styles.stat, { color: color.text }]}>Offen</Text></SurfaceCard></View></View></BackofficePage>; }
