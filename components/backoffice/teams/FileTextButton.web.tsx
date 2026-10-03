import { useRef } from 'react';
import { Button } from '@/components/ui/Button';

/** Excel speichert CSV oft als Windows-1252; dann statt UTF-8 so lesen, damit Umlaute stimmen. */
function decode(buffer: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** Web: verstecktes `<input type="file">`, liest die gewählte CSV als Text. */
export function FileTextButton({
  onText,
  onError,
}: {
  onText: (text: string, fileName: string) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: { target: HTMLInputElement }) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      onError('Die Datei ist zu groß (max. 2 MB).');
      return;
    }
    file
      .arrayBuffer()
      .then((buffer) => onText(decode(buffer), file.name))
      .catch(() => onError('Die Datei konnte nicht gelesen werden.'));
  };

  return (
    <>
      <Button label="CSV-Datei wählen" leftIcon="upload" onPress={() => inputRef.current?.click()} variant="outline" />
      <input
        accept=".csv,.txt,text/csv,text/plain"
        onChange={handleChange}
        ref={inputRef}
        style={{ display: 'none' }}
        type="file"
      />
    </>
  );
}
