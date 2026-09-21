import { useState } from 'react';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { useCreateTeamBatch } from '@/lib/api/teams';

export function QuickTeamsModal({ eventId, visible, onClose }: { eventId: string; visible: boolean; onClose: () => void }) {
  const batchCreate = useCreateTeamBatch(eventId);
  const [count, setCount] = useState('8');
  const [prefix, setPrefix] = useState('Team');
  const [startNumber, setStartNumber] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const n = Number(count);
    const start = Number(startNumber);
    if (!Number.isInteger(n) || n < 1 || n > 64) {
      setError('Bitte eine Anzahl zwischen 1 und 64 eingeben.');
      return;
    }
    try {
      await batchCreate.mutateAsync({ count: n, prefix: prefix.trim() || 'Team', startNumber: Number.isInteger(start) ? start : 1 });
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet
      error={error}
      isSubmitting={batchCreate.isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Anlegen"
      title="Mehrere Teams anlegen"
      visible={visible}
    >
      <Field keyboardType="number-pad" label="Anzahl" onChangeText={setCount} value={count} />
      <Field label="Namensschema" onChangeText={setPrefix} placeholder="Team" value={prefix} />
      <Field keyboardType="number-pad" label="Start-Nummer" onChangeText={setStartNumber} value={startNumber} />
    </FormSheet>
  );
}
