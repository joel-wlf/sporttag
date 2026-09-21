import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Header } from '@/components/layout/Header';
import { moreLinks } from '@/components/layout/navigation';
import { Screen } from '@/components/layout/Screen';
import { Card } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';

export default function MoreScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Header
        description="Weitere Module des Backoffice, gruppiert nach dem Event-Lebenszyklus."
        eyebrow="BACKOFFICE"
        title="Mehr"
      />
      <Card>
        <View className="gap-1">
          {moreLinks.map((item) => (
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
    </Screen>
  );
}
