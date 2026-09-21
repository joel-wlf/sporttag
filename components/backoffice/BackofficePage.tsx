import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { palette } from '@/components/ui/theme';
import { useTheme } from '@/hooks/useTheme';

export function BackofficePage({ title, description, eyebrow, children }: { title: string; description: string; eyebrow?: string; children: React.ReactNode }) {
  const color = palette(useTheme());
  return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.page}><View style={styles.heading}>{eyebrow ? <Text style={[styles.eyebrow, { color: color.accent }]}>{eyebrow}</Text> : null}<Text style={[styles.title, { color: color.text }]}>{title}</Text><Text style={[styles.description, { color: color.muted }]}>{description}</Text></View>{children}</View></ScrollView>;
}

export function SurfaceCard({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  const color = palette(useTheme());
  return <View style={[styles.card, { backgroundColor: muted ? color.surfaceMuted : color.surface, borderColor: color.border }]}>{children}</View>;
}

export const backofficeStyles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, cardGrow: { flexGrow: 1, flexBasis: 260 }, cardWide: { flexGrow: 1, flexBasis: 480 }, cardTitle: { fontSize: 16, fontWeight: '800' }, cardDescription: { fontSize: 13, lineHeight: 20 }, stat: { fontSize: 30, fontWeight: '800', letterSpacing: -1 }, label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.7 }, list: { gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, rowText: { flex: 1, fontSize: 14, fontWeight: '600' }, badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }, badgeText: { fontSize: 11, fontWeight: '800' } });
const styles = StyleSheet.create({ scroll: { flexGrow: 1 }, page: { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 34, paddingBottom: 64, gap: 22 }, heading: { maxWidth: 760, gap: 7 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8 }, description: { fontSize: 15, lineHeight: 22 }, card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 20, gap: 12, shadowColor: '#151910', shadowOpacity: 0.045, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 1 } });
