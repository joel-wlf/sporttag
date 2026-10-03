import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTokens } from '@/components/ui/theme';

export function Screen({
  children,
  size = 'wide',
  scroll = true,
  density = 'comfortable',
  footer,
  className,
}: {
  children: React.ReactNode;
  size?: 'wide' | 'narrow';
  scroll?: boolean;
  density?: 'comfortable' | 'compact';
  footer?: React.ReactNode;
  className?: string;
}) {
  const tokens = useTokens();
  const inner = (
    <View
      className={[
        'w-full grow self-center',
        density === 'compact' ? 'gap-4 px-5 pt-4 pb-6' : 'gap-6 px-6 pt-8 pb-16',
        size === 'narrow' ? 'max-w-[760px]' : 'max-w-[1320px]',
        className ?? '',
      ].join(' ')}
    >
      {children}
    </View>
  );

  const body = !scroll ? (
    <View className="flex-1 bg-canvas">{inner}</View>
  ) : (
    <ScrollView
      alwaysBounceVertical={false}
      bounces={false}
      className="flex-1 bg-canvas"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      overScrollMode="never"
    >
      {inner}
    </ScrollView>
  );

  if (!footer) {
    // Auch ohne Aktionsleiste den unteren Sicherheitsbereich freihalten: in
    // Tab-Screens gehört die schwebende Tab-Leiste dazu, sonst lief der
    // Inhalt (z. B. die Hilfe-Knöpfe) unter sie.
    return (
      <SafeAreaView
        edges={{ bottom: 'additive' }}
        style={{ flex: 1, backgroundColor: tokens.background }}
      >
        {body}
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      {body}
      {/* Native SafeAreaView statt Fenster-Insets: in Tab-Screens gehört die
          schwebende Tab-Leiste zum Sicherheitsbereich, sonst klebte die
          Aktionsleiste direkt an (bzw. unter) ihr. */}
      <SafeAreaView
        edges={{ bottom: 'additive' }}
        style={{ paddingBottom: 12, backgroundColor: tokens.background }}
      >
        {/* Klassen auf der inneren View: NativeWind stylt die native
            SafeAreaView nicht, Abstände und Breite gingen sonst verloren. */}
        <View
          className={[
            'w-full self-center bg-canvas',
            density === 'compact' ? 'px-5 pt-2' : 'px-6 pt-3',
            size === 'narrow' ? 'max-w-[760px]' : 'max-w-[1320px]',
          ].join(' ')}
        >
          {footer}
        </View>
      </SafeAreaView>
    </View>
  );
}
