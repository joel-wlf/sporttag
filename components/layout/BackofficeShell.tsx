import { type Href, Link, usePathname } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '@/components/ui/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSession } from '@/providers/SessionProvider';

type NavigationItem = { href: Href; label: string };
const navigation: NavigationItem[] = [
  { href: '/', label: 'Übersicht' },
  { href: '/planning', label: 'Planung' },
  { href: '/live', label: 'Live-Betrieb' },
  { href: '/results', label: 'Ergebnisse' },
  { href: '/devices', label: 'Geräte & Sync' },
  { href: '/settings', label: 'Einstellungen' },
];

function SidebarContent({ close }: { close?: () => void }) {
  const pathname = usePathname();
  const color = palette(useTheme());
  const { session } = useSession();
  return (
    <View style={styles.sidebarInner}>
      <View style={styles.brandRow}>
        <Image
          source={require('@/assets/branding/app-icon/app-icon.png')}
          style={styles.brandMark}
        />
        <View>
          <Text style={[styles.brandTitle, { color: color.text }]}>Sporttag</Text>
          <Text style={[styles.eyebrow, { color: color.muted }]}>BACKOFFICE</Text>
        </View>
      </View>
      <View
        style={[
          styles.eventCard,
          { backgroundColor: color.surfaceMuted, borderColor: color.border },
        ]}
      >
        <Text style={[styles.eventLabel, { color: color.muted }]}>VERANSTALTUNG</Text>
        <Text style={[styles.eventTitle, { color: color.text }]}>Keine ausgewählt</Text>
      </View>
      <View accessibilityRole="menu" style={styles.navigation}>
        {navigation.map((item) => {
          const href = String(item.href);
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link asChild href={item.href} key={href}>
              <Pressable
                accessibilityRole="menuitem"
                onPress={close}
                style={({ pressed }) => [
                  styles.navItem,
                  active && { backgroundColor: color.accentSoft },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.activeMarker, active && { backgroundColor: color.accent }]} />
                <Text style={[styles.navLabel, { color: active ? color.text : color.muted }]}>
                  {item.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
      <View style={styles.sidebarFooter}>
        <View style={[styles.avatar, { backgroundColor: color.secondary }]}>
          <Text style={styles.avatarText}>
            {session?.user.email?.slice(0, 1).toUpperCase() ?? 'O'}
          </Text>
        </View>
        <View style={styles.accountCopy}>
          <Text numberOfLines={1} style={[styles.accountTitle, { color: color.text }]}>
            Organisator
          </Text>
          <Text numberOfLines={1} style={[styles.accountMeta, { color: color.muted }]}>
            {session?.user.email ?? 'Angemeldet'}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function BackofficeShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const color = palette(useTheme());
  const wide = width >= 960;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: color.background }]}
    >
      <View style={styles.shell}>
        {wide ? (
          <View
            style={[styles.sidebar, { backgroundColor: color.surface, borderColor: color.border }]}
          >
            <SidebarContent />
          </View>
        ) : (
          <View
            style={[
              styles.mobileHeader,
              { backgroundColor: color.surface, borderColor: color.border },
            ]}
          >
            <Pressable
              accessibilityLabel="Navigation öffnen"
              accessibilityRole="button"
              onPress={() => setMenuOpen(true)}
              style={({ pressed }) => [
                styles.menuButton,
                { borderColor: color.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.menuLines, { color: color.text }]}>☰</Text>
            </Pressable>
            <View style={styles.mobileBrand}>
              <Text style={[styles.mobileTitle, { color: color.text }]}>Sporttag</Text>
              <Text style={[styles.mobileMeta, { color: color.muted }]}>Backoffice</Text>
            </View>
            <View style={[styles.connectionDot, { backgroundColor: color.secondary }]} />
          </View>
        )}
        <View style={styles.content}>{children}</View>
      </View>
      <Modal
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
        transparent
        visible={menuOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Navigation schließen"
            onPress={() => setMenuOpen(false)}
            style={styles.backdrop}
          />
          <SafeAreaView style={[styles.drawer, { backgroundColor: color.surface }]}>
            <View style={styles.drawerCloseRow}>
              <Pressable
                accessibilityLabel="Navigation schließen"
                accessibilityRole="button"
                onPress={() => setMenuOpen(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  { borderColor: color.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.closeText, { color: color.text }]}>×</Text>
              </Pressable>
            </View>
            <SidebarContent close={() => setMenuOpen(false)} />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  shell: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 280, borderRightWidth: StyleSheet.hairlineWidth },
  sidebarInner: { flex: 1, paddingHorizontal: 18, paddingVertical: 22 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  brandMark: { width: 38, height: 38, borderRadius: 12 },
  brandTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  eventCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    marginBottom: 18,
  },
  eventLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  eventTitle: { fontSize: 14, fontWeight: '700' },
  navigation: { gap: 5 },
  navItem: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  activeMarker: { width: 3, height: 20, borderRadius: 2, backgroundColor: 'transparent' },
  navLabel: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.68 },
  sidebarFooter: {
    marginTop: 'auto',
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '900' },
  accountCopy: { flex: 1, minWidth: 0 },
  accountTitle: { fontSize: 13, fontWeight: '700' },
  accountMeta: { fontSize: 11, marginTop: 2 },
  content: { flex: 1, minWidth: 0 },
  mobileHeader: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  menuLines: { fontSize: 20, marginTop: Platform.OS === 'android' ? -2 : 0 },
  mobileBrand: { flex: 1, paddingHorizontal: 12 },
  mobileTitle: { fontSize: 16, fontWeight: '800' },
  mobileMeta: { fontSize: 11, marginTop: 1 },
  connectionDot: { width: 10, height: 10, borderRadius: 5 },
  modalRoot: { flex: 1, flexDirection: 'row' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(20, 23, 17, 0.42)' },
  drawer: {
    width: 310,
    maxWidth: '86%',
    height: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  drawerCloseRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 8,
    marginBottom: -48,
    zIndex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 25, lineHeight: 27 },
});
