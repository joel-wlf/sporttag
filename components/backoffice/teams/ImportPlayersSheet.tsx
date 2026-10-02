import { useMemo, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { FormSheet } from '@/components/ui/FormSheet';
import { useTokens } from '@/components/ui/theme';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useImportPlayers } from '@/lib/api/players';
import type { TeamRow } from '@/lib/api/teams';
import { genderShort } from '@/lib/teams/balance';
import { parsePlayersCsv } from '@/lib/teams/csv';
import { FileTextButton } from './FileTextButton';

const PREVIEW_ROWS = 8;

/**
 * Spieler aus einer CSV-Liste übernehmen: Datei wählen (Web) oder Inhalt
 * einfügen, Vorschau mit erkannten Spalten und Hinweisen, dann importieren.
 */
export function ImportPlayersSheet({
  eventId,
  teams,
  existingNames,
  visible,
  onClose,
}: {
  eventId: string;
  teams: TeamRow[];
  existingNames: string[];
  visible: boolean;
  onClose: () => void;
}) {
  const tokens = useTokens();
  const importPlayers = useImportPlayers(eventId);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePlayersCsv(text, teams, existingNames), [text, teams, existingNames]);
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? '';

  const close = () => {
    setText('');
    setFileName(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    if (parsed.rows.length === 0) {
      setError('Keine Spieler erkannt. Füge eine Liste mit mindestens einer Namensspalte ein.');
      return;
    }
    try {
      await importPlayers.mutateAsync(
        parsed.rows.map((r) => ({ name: r.name, team_id: r.teamId, gender: r.gender, skill: r.skill, age: r.age })),
      );
      close();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet
      error={error}
      isSubmitting={importPlayers.isPending}
      onClose={close}
      onSubmit={handleSubmit}
      submitLabel={parsed.rows.length ? `${parsed.rows.length} importieren` : 'Importieren'}
      title="Spieler importieren"
      visible={visible}
    >
      <Text className="text-[13px] leading-5 text-subtle">
        Eine Zeile pro Spieler. Erkannte Spalten: Name (oder Vorname + Nachname), Geschlecht (m/w/d), Alter, Stärke (1–6, 6 = sehr
        stark) und Team. Trennzeichen Semikolon, Komma oder Tab.
      </Text>
      <View className="flex-row flex-wrap items-center gap-3">
        <FileTextButton
          onError={setError}
          onText={(content, name) => {
            setText(content);
            setFileName(name);
            setError(null);
          }}
        />
        {fileName ? <Text className="text-[13px] font-semibold text-ink">{fileName}</Text> : null}
      </View>
      <View className="gap-2">
        <Text className="text-[13px] font-bold text-ink">CSV-Inhalt</Text>
        <TextInput
          accessibilityLabel="CSV-Inhalt"
          className="min-h-[140px] rounded-[14px] border border-line bg-canvas px-4 py-3 text-[14px] text-ink outline-none"
          multiline
          onChangeText={(value) => {
            setText(value);
            setFileName(null);
          }}
          placeholder={'Vorname;Nachname;Geschlecht;Alter;Stärke\nAnna;Meier;w;12;5'}
          placeholderTextColor={tokens.subtle}
          style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
          textAlignVertical="top"
          value={text}
        />
      </View>

      {parsed.rows.length > 0 ? (
        <View className="gap-2">
          <Text className="text-[13px] font-bold text-ink">
            Vorschau · {parsed.rows.length} Spieler
            {parsed.columns.length ? ` · Spalten: ${parsed.columns.join(', ')}` : ''}
          </Text>
          <View className="overflow-hidden rounded-2xl border border-line">
            {parsed.rows.slice(0, PREVIEW_ROWS).map((r, i) => (
              <View
                className={['flex-row items-center gap-3 px-3 py-2', i > 0 ? 'border-t border-line' : ''].join(' ')}
                key={r.line}
              >
                <Text className="flex-1 text-[13px] font-semibold text-ink" numberOfLines={1}>
                  {r.name}
                </Text>
                <Text className="w-5 text-[12px] text-subtle">{r.gender ? genderShort[r.gender] : '–'}</Text>
                <Text className="w-8 text-[12px] text-subtle">{r.age ?? '–'}</Text>
                <Text className="w-6 text-[12px] font-bold text-ink">{r.skill ?? '–'}</Text>
                <Text className="w-20 text-[12px] text-subtle" numberOfLines={1}>
                  {teamName(r.teamId)}
                </Text>
              </View>
            ))}
            {parsed.rows.length > PREVIEW_ROWS ? (
              <Text className="border-t border-line px-3 py-2 text-[12px] text-subtle">
                … und {parsed.rows.length - PREVIEW_ROWS} weitere
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {parsed.issues.length > 0 ? (
        <View className="gap-1 rounded-2xl bg-warning-soft px-4 py-3">
          <Text className="text-[13px] font-bold text-warning">{parsed.issues.length} Hinweise</Text>
          {parsed.issues.slice(0, 10).map((issue, i) => (
            <Text className="text-[12px] text-warning" key={`${issue.line}-${i}`}>
              Zeile {issue.line}: {issue.message}
            </Text>
          ))}
          {parsed.issues.length > 10 ? (
            <Text className="text-[12px] text-warning">… und {parsed.issues.length - 10} weitere</Text>
          ) : null}
        </View>
      ) : null}
    </FormSheet>
  );
}
