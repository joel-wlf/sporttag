import { Text, View } from 'react-native';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

/** Abschnittskarte der Rechtstexte: Titel, optionale Einleitung, Absätze. */
export function LegalSection({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle accessibilityRole="header">{title}</CardTitle>
        {intro ? <CardDescription>{intro}</CardDescription> : null}
      </CardHeader>
      {children ? <View className="gap-3">{children}</View> : null}
    </Card>
  );
}

export function LegalParagraph({ children }: { children: React.ReactNode }) {
  return <Text className="text-[15px] leading-6 text-ink">{children}</Text>;
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <View className="gap-2">
      {items.map((item) => (
        <View className="flex-row gap-2" key={item}>
          <Text className="text-[15px] leading-6 text-primary">•</Text>
          <Text className="flex-1 text-[15px] leading-6 text-ink">{item}</Text>
        </View>
      ))}
    </View>
  );
}
