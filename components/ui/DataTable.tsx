import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { haptic } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';
import { useTokens } from './theme';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  width?: number;
  flex?: number;
  align?: 'left' | 'right';
  render: (item: T) => ReactNode;
};

/**
 * Real HTML-table-style list for desktop/web. Renders as a header row plus
 * one row per item, each column sized by `width` (fixed) or `flex` (default 1).
 * Use for desktop (see useDesktop) — keep ListRow-based cards for mobile.
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowPress,
  showChevron = Boolean(onRowPress),
}: {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowPress?: (item: T) => void;
  showChevron?: boolean;
}) {
  const tokens = useTokens();

  return (
    <View>
      <View className="flex-row items-center gap-4 border-b border-line px-4 pb-2.5">
        {columns.map((col) => (
          <View key={col.key} style={col.width ? { width: col.width } : { flex: col.flex ?? 1 }}>
            <Text
              className="text-[11px] font-bold uppercase tracking-[0.4px] text-subtle"
              style={col.align === 'right' ? { textAlign: 'right' } : undefined}
            >
              {col.header}
            </Text>
          </View>
        ))}
        {showChevron ? <View className="w-4" /> : null}
      </View>

      {data.map((item, index) => {
        const key = keyExtractor(item);
        const rowContent = (
          <>
            {columns.map((col) => (
              <View key={col.key} style={col.width ? { width: col.width } : { flex: col.flex ?? 1 }}>
                {col.render(item)}
              </View>
            ))}
            {showChevron ? <Icon color={tokens.subtle} name="chevron-right" size={16} /> : null}
          </>
        );

        const rowClassName = [
          'flex-row items-center gap-4 px-4 py-3',
          index < data.length - 1 ? 'border-b border-line' : '',
          onRowPress ? 'active:bg-primary-soft hover:bg-primary-soft' : '',
        ].join(' ');

        if (!onRowPress) {
          return (
            <View className={rowClassName} key={key}>
              {rowContent}
            </View>
          );
        }

        return (
          <Pressable
            accessibilityRole="button"
            className={rowClassName}
            key={key}
            onPress={() => onRowPress(item)}
            onPressIn={() => haptic('heavy')}
          >
            {rowContent}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Inline-editable table cell: looks like plain text, becomes a text input on
 * focus, and commits via `onCommit` on blur/submit (only if the value changed).
 */
export function EditableCell({
  value,
  onCommit,
  placeholder,
  numeric = false,
  subtle = false,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  numeric?: boolean;
  subtle?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <TextInput
      className={[
        '-mx-2 -my-1 rounded-lg px-2 py-1 text-[14px] hover:bg-primary-soft',
        subtle ? 'text-subtle' : 'font-semibold text-ink',
      ].join(' ')}
      keyboardType={numeric ? 'number-pad' : 'default'}
      onBlur={commit}
      onChangeText={setDraft}
      onSubmitEditing={commit}
      placeholder={placeholder}
      value={draft}
    />
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <View className="flex-row items-center justify-end gap-1">{children}</View>;
}

export function RowActionButton({
  icon,
  onPress,
  tone = 'default',
  accessibilityLabel,
}: {
  icon: IconName;
  onPress: () => void;
  tone?: 'default' | 'danger';
  accessibilityLabel: string;
}) {
  const tokens = useTokens();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="h-8 w-8 items-center justify-center rounded-lg active:bg-primary-soft hover:bg-primary-soft"
      onPress={onPress}
    >
      <Icon color={tone === 'danger' ? tokens.danger : tokens.subtle} name={icon} size={16} />
    </Pressable>
  );
}

export function DataTableText({
  children,
  subtle = false,
  numberOfLines = 1,
}: {
  children: ReactNode;
  subtle?: boolean;
  numberOfLines?: number;
}) {
  return (
    <Text
      className={['text-[14px]', subtle ? 'text-subtle' : 'font-semibold text-ink'].join(' ')}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}
