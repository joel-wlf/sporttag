import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { LiveFilterChips, type LiveFilter } from '@/components/backoffice/live/LiveFilterChips';
import { LiveStatusBar } from '@/components/backoffice/live/LiveStatusBar';
import { MapLegend } from '@/components/backoffice/live/MapLegend';
import { StationLiveDetail } from '@/components/backoffice/live/StationLiveDetail';
import { StationLiveList } from '@/components/backoffice/live/StationLiveList';
import { statusColor } from '@/components/backoffice/live/liveStatusColor';
import { SatelliteMap } from '@/components/map/SatelliteMap';
import type { MapPin } from '@/components/map/types';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useTokens } from '@/components/ui/theme';
import { useDesktop } from '@/components/ui/useDesktop';
import { useDeviceSyncOverview } from '@/lib/api/devices';
import { venueBoundsFromEvent } from '@/lib/api/events';
import { useEventGames } from '@/lib/api/games';
import { useActiveCheckins, useCurrentResultValues, useLiveRealtime, useOpenSubmissions } from '@/lib/api/live';
import { useBlocks, useMatchParticipants, useMatches, useRounds, useStationSetups, type RoundRow } from '@/lib/api/schedule';
import { useEventStaff } from '@/lib/api/staff';
import { useStations } from '@/lib/api/stations';
import { useTeams } from '@/lib/api/teams';
import { STALE_DEVICE_MS, buildStationLive, liveGroupOf, pickCurrentRound } from '@/lib/live/derive';
import { useEventHealthLiveActivity } from '@/lib/live/useEventHealthLiveActivity';
import { useActiveEvent } from '@/providers/ActiveEventProvider';

/** Auf Web bleibt die Karte beim Scrollen der Stationsliste stehen. */
const stickyStyle = (Platform.OS === 'web' ? { position: 'sticky', top: 16 } : {}) as unknown as ViewStyle;

function LiveContent() {
  const tokens = useTokens();
  // Karte + Seitenspalte nebeneinander erst, wenn die Karte daneben noch breit genug bleibt.
  const desktop = useDesktop(1180);
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const { eventId, event } = useActiveEvent();

  const { data: stations } = useStations(eventId);
  const { data: blocks } = useBlocks(eventId);
  const { data: rounds } = useRounds(eventId);
  const { data: stationSetups } = useStationSetups(eventId);
  const { data: matches } = useMatches(eventId);
  const { data: matchParticipants } = useMatchParticipants(eventId);
  const { data: teams } = useTeams(eventId);
  const { data: eventGames } = useEventGames(eventId);
  const { data: staff } = useEventStaff(eventId);
  const { data: deviceSync } = useDeviceSyncOverview(eventId);
  const { data: activeCheckins } = useActiveCheckins(eventId);
  const { data: openSubmissions } = useOpenSubmissions(eventId);
  const { data: currentResultValues } = useCurrentResultValues(eventId);
  const { connected, lastUpdated } = useLiveRealtime(eventId);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const playRounds = useMemo(
    () =>
      (rounds ?? [])
        .filter((r) => r.kind === 'play')
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [rounds],
  );

  // `null` = automatisch der aktuellen Runde folgen; ‹/› pinnt eine konkrete Runde.
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const currentRound = useMemo(() => pickCurrentRound(playRounds, now), [playRounds, now]);
  const selectedRound: RoundRow | null = useMemo(
    () => (selectedRoundId ? playRounds.find((r) => r.id === selectedRoundId) : undefined) ?? currentRound,
    [selectedRoundId, playRounds, currentRound],
  );
  const roundIndex = selectedRound ? playRounds.findIndex((r) => r.id === selectedRound.id) : -1;

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LiveFilter>('all');

  const rows = useMemo(
    () =>
      buildStationLive({
        stations: stations ?? [],
        round: selectedRound,
        blocks: blocks ?? [],
        stationSetups: stationSetups ?? [],
        matches: matches ?? [],
        matchParticipants: matchParticipants ?? [],
        teams: teams ?? [],
        games: eventGames ?? [],
        activeCheckins: activeCheckins ?? [],
        devices: deviceSync ?? [],
        openSubmissions: openSubmissions ?? [],
        currentResultValues: currentResultValues ?? [],
        now,
      }),
    [stations, selectedRound, blocks, stationSetups, matches, matchParticipants, teams, eventGames, activeCheckins, deviceSync, openSubmissions, currentResultValues, now],
  );

  const eventHealthActivity = useEventHealthLiveActivity({
    eventName: event?.name ?? 'Sporttag',
    rows,
    roundEndsAt: selectedRound?.ends_at ?? null,
  });

  const staffNames = useMemo(() => Object.fromEntries((staff ?? []).map((s) => [s.id, s.display_name])), [staff]);
  const visibleRows = filter === 'all' ? rows : rows.filter((r) => liveGroupOf[r.status] === filter);
  const unreachableDevices = (deviceSync ?? []).filter(
    (d) => d.expected && !d.revoked_at && d.last_seen_at && now.getTime() - new Date(d.last_seen_at).getTime() > STALE_DEVICE_MS,
  ).length;

  const pins: MapPin[] = visibleRows
    .filter((r) => r.station.latitude !== null && r.station.longitude !== null)
    .map((r) => ({
      id: r.station.id,
      coordinate: [r.station.longitude as number, r.station.latitude as number],
      label: r.station.name,
      color: statusColor(tokens, r.status),
      badge: r.openSubmissions.length > 0 ? '!' : undefined,
      scoreLabel: r.scoreLabel ?? undefined,
      selected: r.station.id === selectedStationId,
    }));

  const selectedRow = rows.find((r) => r.station.id === selectedStationId) ?? null;
  const bounds = event ? venueBoundsFromEvent(event) : null;
  const unplacedCount = rows.filter((r) => r.station.latitude === null || r.station.longitude === null).length;
  const openResults = (matchId?: string) => router.push(matchId ? { pathname: '/results', params: { matchId } } : '/results');

  const statusBar = (
    <LiveStatusBar
      connected={connected}
      hasNext={roundIndex >= 0 && roundIndex < playRounds.length - 1}
      hasPrev={roundIndex > 0}
      isCurrent={!selectedRound || selectedRound.id === currentRound?.id}
      lastUpdated={lastUpdated}
      liveActivity={{ active: eventHealthActivity.active, onToggle: eventHealthActivity.active ? eventHealthActivity.stop : eventHealthActivity.start }}
      now={now}
      onNext={() => roundIndex < playRounds.length - 1 && setSelectedRoundId(playRounds[roundIndex + 1].id)}
      onNow={() => setSelectedRoundId(null)}
      onOpenSchedule={() => router.push('/planning/schedule')}
      onPrev={() => roundIndex > 0 && setSelectedRoundId(playRounds[roundIndex - 1].id)}
      round={selectedRound}
      roundCount={playRounds.length}
      roundNumber={roundIndex + 1}
      unreachableDevices={unreachableDevices}
    />
  );

  const draftNotice =
    event?.status === 'draft' ? (
      <View className="flex-row items-center gap-2 rounded-2xl bg-warning-soft px-4 py-3">
        <Icon color={tokens.warning} name="alert" size={16} />
        <Text className="flex-1 text-[13px] font-semibold text-warning">
          Entwurf – Stationsgeräte können erst nach der Veröffentlichung beitreten. Bis dahin bleibt diese Ansicht leer.
        </Text>
      </View>
    ) : null;

  const list = (
    <View className="gap-3">
      <LiveFilterChips onChange={setFilter} rows={rows} value={filter} />
      {visibleRows.length === 0 ? (
        <Card variant="muted">
          <Text className="text-center text-[13px] text-subtle">
            {filter === 'attention' ? 'Keine Probleme – alles läuft.' : 'Keine Stationen in dieser Auswahl.'}
          </Text>
        </Card>
      ) : (
        <StationLiveList grouped={filter === 'all'} now={now} onSelect={setSelectedStationId} rows={visibleRows} selectedId={selectedStationId} />
      )}
      {unplacedCount > 0 ? (
        <Text className="px-1 text-[12px] text-subtle">
          {unplacedCount} {unplacedCount === 1 ? 'Station hat' : 'Stationen haben'} noch keinen Standort und {unplacedCount === 1 ? 'fehlt' : 'fehlen'} auf der Karte.
        </Text>
      ) : null}
    </View>
  );

  if ((stations ?? []).length === 0) {
    return (
      <Screen>
        <Header eyebrow="VERANSTALTUNGSTAG" title="Live-Betrieb" />
        <Card>
          <EmptyState
            action={<Button label="Stationen anlegen" onPress={() => router.push('/planning/venue')} size="sm" />}
            description="Lege zuerst Stationen mit Standort an, um sie hier live auf der Karte zu verfolgen."
            icon="map-pin"
            title="Noch keine Stationen"
          />
        </Card>
      </Screen>
    );
  }

  if (!desktop) {
    return (
      <Screen density="compact">
        <Header eyebrow="VERANSTALTUNGSTAG" title="Live-Betrieb" />
        {draftNotice}
        {statusBar}
          <Card className="overflow-hidden" style={{ gap: 0, padding: 0 }}>
          <SatelliteMap
            bounds={bounds}
            height={Math.max(260, Math.round(windowHeight * 0.4))}
            onPinPress={setSelectedStationId}
            pins={pins}
            fitToPins
            scrollWheelZoom={false}
          />
          <MapLegend />
        </Card>
        {list}

        <Modal
          animationType="slide"
          onRequestClose={() => setSelectedStationId(null)}
          presentationStyle="pageSheet"
          visible={Boolean(selectedRow)}
        >
          <ScrollView className="flex-1 bg-canvas" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {selectedRow ? (
              <StationLiveDetail
                eventId={eventId as string}
                now={now}
                onClose={() => setSelectedStationId(null)}
                onOpenResults={() => {
                  setSelectedStationId(null);
                  openResults(selectedRow.match?.id);
                }}
                row={selectedRow}
                staffNames={staffNames}
              />
            ) : null}
          </ScrollView>
        </Modal>
      </Screen>
    );
  }

  const mapHeight = Math.min(760, Math.max(420, windowHeight - 220));

  return (
    <Screen density="compact">
      <Header eyebrow="VERANSTALTUNGSTAG" title="Live-Betrieb" />
      {draftNotice}
      {statusBar}
      <View className="flex-row items-start gap-5">
        <View className="min-w-0 flex-1" style={stickyStyle}>
          <Card className="overflow-hidden" style={{ gap: 0, padding: 0 }}>
            <SatelliteMap bounds={bounds} height={mapHeight} onPinPress={setSelectedStationId} fitToPins pins={pins} scrollWheelZoom={false} />
            <MapLegend />
          </Card>
        </View>
        <View className="w-[420px] gap-4">
          {selectedRow ? (
            <StationLiveDetail
              eventId={eventId as string}
              now={now}
              onBack={() => setSelectedStationId(null)}
              onOpenResults={() => openResults(selectedRow.match?.id)}
              row={selectedRow}
              staffNames={staffNames}
            />
          ) : (
            list
          )}
        </View>
      </View>
    </Screen>
  );
}

export default function LiveScreen() {
  return (
    <RequireEvent>
      <LiveContent />
    </RequireEvent>
  );
}
