import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
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
    return body;
  }

  return (
    <View className="flex-1 bg-canvas">
      {body}
      <View
        className={[
          'w-full self-center bg-canvas',
          density === 'compact' ? 'px-5 pt-2' : 'px-6 pt-3',
          size === 'narrow' ? 'max-w-[760px]' : 'max-w-[1320px]',
        ].join(' ')}
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {footer}
      </View>
    </View>
  );
}
