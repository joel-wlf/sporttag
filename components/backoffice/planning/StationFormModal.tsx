import { useState } from 'react';
import type { LngLat } from '@/components/map/types';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Input';
import { FormSheet } from '@/components/ui/FormSheet';
import { friendlyErrorMessage } from '@/lib/api/errors';
import { type StationRow, useDeleteStation, useUpsertStation } from '@/lib/api/stations';

export function StationFormModal({
  eventId,
  station,
  pendingCoordinate,
  onRequestMapPick,
  onClose,
}: {
  eventId: string;
  station: StationRow | 'new' | null;
  /** Vom Kartentipp übernommene Koordinate; überschreibt den bisherigen Stationsstandort. */
  pendingCoordinate?: LngLat | null;
  /** Öffnet den Kartenauswahl-Modus für die aktuell bearbeitete Station erneut. */
  onRequestMapPick?: () => void;
  onClose: () => void;
}) {
  const upsert = useUpsertStation(eventId);
  const remove = useDeleteStation(eventId);
  const existing = station && station !== 'new' ? station : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [latitude, setLatitude] = useState(() =>
    pendingCoordinate ? String(pendingCoordinate[1]) : existing?.latitude != null ? String(existing.latitude) : '',
  );
  const [longitude, setLongitude] = useState(() =>
    pendingCoordinate ? String(pendingCoordinate[0]) : existing?.longitude != null ? String(existing.longitude) : '',
  );
  const [arrivalNotes, setArrivalNotes] = useState(existing?.arrival_notes ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.');
      return;
    }
    const noLocation = !latitude.trim() && !longitude.trim();
    const lat = noLocation ? null : Number(latitude.replace(',', '.'));
    const lng = noLocation ? null : Number(longitude.replace(',', '.'));
    if (
      lat !== null &&
      lng !== null &&
      (!Number.isFinite(lat) || lat < -85 || lat > 85 || !Number.isFinite(lng) || lng < -180 || lng > 180)
    ) {
      setError('Bitte gültige WGS84-Koordinaten eingeben oder beide Felder leer lassen.');
      return;
    }
    try {
      await upsert.mutateAsync({
        id: station && station !== 'new' ? station.id : undefined,
        name: name.trim(),
        location: location.trim() || null,
        latitude: lat,
        longitude: lng,
        arrival_notes: arrivalNotes.trim() || null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!station || station === 'new') return;
    setError(null);
    try {
      await remove.mutateAsync(station.id);
      onClose();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  };

  return (
    <FormSheet
      error={error}
      isSubmitting={upsert.isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      secondaryAction={
        station && station !== 'new' ? (
          <Button isLoading={remove.isPending} label="Löschen" onPress={handleDelete} variant="danger" />
        ) : undefined
      }
      title={station === 'new' ? 'Neue Station' : 'Station bearbeiten'}
      visible={station !== null}
    >
      <Field label="Name" onChangeText={setName} placeholder="Station 1 – Wiese" value={name} />
      <Field label="Ort (optional)" onChangeText={setLocation} value={location} />
      {onRequestMapPick && existing ? (
        <Button label="Auf Karte neu setzen" onPress={onRequestMapPick} size="sm" variant="outline" />
      ) : null}
      <Field keyboardType="numbers-and-punctuation" label="Breite (Latitude)" onChangeText={setLatitude} placeholder="52.520008" value={latitude} />
      <Field keyboardType="numbers-and-punctuation" label="Länge (Longitude)" onChangeText={setLongitude} placeholder="13.404954" value={longitude} />
      <Field label="Ankunftshinweise (optional)" multiline numberOfLines={2} onChangeText={setArrivalNotes} value={arrivalNotes} />
      <Field label="Notizen (optional)" multiline numberOfLines={2} onChangeText={setNotes} value={notes} />
    </FormSheet>
  );
}
