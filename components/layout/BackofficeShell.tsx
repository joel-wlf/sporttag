import { Link, usePathname } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sidebarGroups } from '@/components/layout/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { useActiveEvent } from '@/providers/ActiveEventProvider';
import { useSession } from '@/providers/SessionProvider';
import type { EventStatus } from '@/lib/api/events';

const statusLabels: Record<EventStatus, string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  running: 'Laufend',
  finished: 'Beendet',
  archived: 'Archiviert',
};

const statusTones: Record<EventStatus, BadgeTone> = {
  draft: 'neutral',
  published: 'primary',
  running: 'success',
  finished: 'secondary',
  archived: 'neutral',
};

function Brand() {
  return (
    <View className="flex-row items-center gap-3 px-2">
      <Image source={require('@/assets/branding/app-icon/app-icon.png')} style={styles.brandMark} />
      <View>
        <Text className="text-[18px] font-extrabold tracking-[-0.3px] text-ink">Sporttag</Text>
        <Text className="text-[10px] font-extrabold tracking-[1.2px] text-subtle">BACKOFFICE</Text>
      </View>
    </View>
  );
}

function SidebarContent() {
  const pathname = usePathname();
  const tokens = useTokens();
  const { session } = useSession();
  const email = session?.user.email ?? 'Angemeldet';
  const { event } = useActiveEvent();

  return (
    <ScrollView
      alwaysBounceVertical={false}
      bounces={false}
      className="flex-1"
      contentContainerStyle={styles.sidebarContent}
      overScrollMode="never"
    >
      <Brand />
      <Link asChild href="/">
        <Pressable className="gap-1.5 rounded-2xl border border-line bg-surface-muted p-3.5 active:opacity-70">
          <Text className="text-[9px] font-extrabold tracking-[0.8px] text-subtle">
            AUSGEWÄHLTE VERANSTALTUNG
          </Text>
          <Text numberOfLines={1} className="text-[14px] font-bold text-ink">
            {event?.name ?? 'Keine ausgewählt'}
          </Text>
          {event ? (
            <Badge tone={statusTones[event.status as EventStatus]} className="self-start">
              {statusLabels[event.status as EventStatus]}
            </Badge>
          ) : null}
        </Pressable>
      </Link>
      <View accessibilityRole="menu" className="gap-5">
        {sidebarGroups.map((group) => (
          <View className="gap-1.5" key={group.title}>
            <Text className="px-3 text-[10px] font-extrabold tracking-[0.9px] text-subtle">
              {group.title.toUpperCase()}
            </Text>
            {group.items.map((item) => {
              const href = String(item.href);
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link asChild href={item.href} key={item.name}>
                  <Pressable
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    className={[
                      'min-h-[44px] flex-row items-center gap-3 rounded-2xl px-3 active:opacity-70',
                      active ? 'bg-primary-soft' : '',
                    ].join(' ')}
                  >
                    <Icon
                      name={item.icon}
                      size={18}
                      color={active ? tokens.primary : tokens.subtle}
                    />
                    <Text
                      className={[
                        'flex-1 text-[13px] font-bold',
                        active ? 'text-primary' : 'text-subtle',
                      ].join(' ')}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ))}
      </View>
      <View className="mt-auto flex-row items-center gap-3 px-2 pt-4">
        <Avatar initials={(email.slice(0, 1) || 'O').toUpperCase()} size={36} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[13px] font-bold text-ink">
            Organisator
          </Text>
          <Text numberOfLines={1} className="mt-0.5 text-[11px] text-subtle">
            {email}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * Backoffice-Rahmen. Auf breiten Bildschirmen eine seitliche Navigation entlang
 * des Event-Lebenszyklus; auf Smartphones übernimmt die native Tab-Leiste
 * aus Expo Router.
 */
export function BackofficeShell({ children, wide }: { children: React.ReactNode; wide: boolean }) {
  const tokens = useTokens();
  return (
    <SafeAreaView
      edges={wide ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
      style={[styles.safe, { backgroundColor: tokens.background }]}
    >
      <View className="flex-1 flex-row">
        {wide ? (
          <View className="w-[280px]">
            <GlassSurface
              className="h-full"
              fallbackClassName="bg-surface border-r border-line"
              style={styles.sidebar}
            >
              <SidebarContent />
            </GlassSurface>
          </View>
        ) : null}
        <View className="min-w-0 flex-1">{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  brandMark: { width: 38, height: 38, borderRadius: 12 },
  sidebar: { height: '100%' },
  sidebarContent: { flexGrow: 1, gap: 20, paddingHorizontal: 16, paddingVertical: 24 },
});
