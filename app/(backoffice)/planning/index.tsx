import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';

const modules: { href: string; icon: IconName; title: string; description: string }[] = [
  {
    href: '/planning/teams',
    icon: 'user',
    title: 'Teams',
    description: 'Feste Teams, Nummern, Farben und Teilnehmerzahlen verwalten.',
  },
  {
    href: '/planning/games',
    icon: 'results',
    title: 'Spiele & Wertung',
    description: 'Event-Spiele, Regeln und Tabellenpunkte konfigurieren.',
  },
  {
    href: '/planning/venue',
    icon: 'map-pin',
    title: 'Gelände & Stationen',
    description: 'Offline-Karte vorbereiten und feste Standorte setzen.',
  },
  {
    href: '/planning/schedule',
    icon: 'clock',
    title: 'Zeitplan & Matches',
    description: 'Blöcke, Runden, Belegungen und Begegnungen planen.',
  },
  {
    href: '/planning/staff',
    icon: 'shield',
    title: 'Betreuung',
    description: 'Personen je Station und Block einteilen.',
  },
];

export default function PlanningHubScreen() {
  const router = useRouter();
  const tokens = useTokens();
  return (
    <Screen>
      <Header
        description="Bausteine für einen vollständigen und offline nutzbaren Sporttag."
        eyebrow="VERANSTALTUNG PLANEN"
        title="Planung"
      />
      <View className="flex-row flex-wrap gap-4">
        {modules.map((module, index) => (
          <Pressable
            className="min-w-0 flex-1 basis-[260px] active:opacity-80"
            key={module.title}
            onPress={() => router.push(module.href as never)}
          >
            <Card className="h-full gap-3">
              <View className="flex-row items-center justify-between">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft">
                  <Icon name={module.icon} size={20} color={tokens.primary} />
                </View>
                <Text className="text-[11px] font-extrabold tracking-[0.7px] text-subtle">
                  {String(index + 1).padStart(2, '0')}
                </Text>
              </View>
              <CardHeader>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.description}</CardDescription>
              </CardHeader>
              <View className="mt-auto flex-row items-center gap-1.5">
                <Text className="text-[12px] font-bold text-primary">Öffnen</Text>
                <Icon name="chevron-right" size={14} color={tokens.primary} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
