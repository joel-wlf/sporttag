import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import type { IconName } from '@/components/ui/Icon';

const steps: { href: string; icon: IconName; title: string; description: string }[] = [
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
  return (
    <Screen>
      <Header
        description="Bausteine für einen vollständigen und offline nutzbaren Sporttag."
        eyebrow="VERANSTALTUNG PLANEN"
        title="Planung"
      />
      <Card>
        <View className="gap-1">
          {steps.map((step) => (
            <ListRow
              icon={step.icon}
              key={step.title}
              onPress={() => router.push(step.href as never)}
              showChevron
              subtitle={step.description}
              title={step.title}
            />
          ))}
        </View>
      </Card>
    </Screen>
  );
}
