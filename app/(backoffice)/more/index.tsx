import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Header } from '@/components/layout/Header';
import { moreGroups } from '@/components/layout/navigation';
import { Screen } from '@/components/layout/Screen';
import { Section } from '@/components/layout/Section';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

export default function MoreScreen() {
  const router = useRouter();
  const { event } = useActiveEvent();
  return (
    <Screen>
      <Header eyebrow="BACKOFFICE" title="Mehr" />
      {moreGroups.map((group) => (
        <Section
          // Die Veranstaltungsmodule gelten für die im Tab „Events“ gewählte Veranstaltung.
          description={group.title === 'Veranstaltung' ? (event?.name ?? 'Keine Veranstaltung gewählt') : undefined}
          key={group.title}
          title={group.title}
        >
          <Card>
            <View className="gap-1">
              {group.items.map((item) => (
                <ListRow
                  icon={item.icon}
                  key={item.name}
                  onPress={() => router.push(item.href)}
                  showChevron
                  title={item.label}
                />
              ))}
            </View>
          </Card>
        </Section>
      ))}
    </Screen>
  );
}
