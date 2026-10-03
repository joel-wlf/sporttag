import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { RequireEvent } from '@/components/backoffice/RequireEvent';
import { LiveFilterChips, type LiveFilter } from '@/components/backoffice/live/LiveFilterChips';
import { LiveStatusBar } from '@/components/backoffice/live/LiveStatusBar';
import { MapLegend } from '@/components/backoffice/live/MapLegend';
import { StationLiveDetail } from '@/components/backoffice/live/StationLiveDetail';
import { StationLiveList } from '@/components/backoffice/live/StationLiveList';
import { TimelinePanel } from '@/components/backoffice/live/TimelinePanel';
import type { GanttMode } from '@/components/backoffice/live/TimelineGantt';
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
import { ViewSwitch } from '@/components/ui/ViewSwitch';
import { useDesktop } from '@/components/ui/useDesktop';
import { useDeviceSyncOverview } from '@/lib/api/devices';
import { venueBoundsFromEvent } from '@/lib/api/events';
import { useEventGames } from '@/lib/api/games';
import {
  useActiveCheckins,
  useCurrentResultValues,
  useLiveRealtime,
  useMatchLiveStates,
  useOpenSubmissions,
  useTeamVisits,
} from '@/lib/api/live';
import { useBlocks, useMatchParticipants, useMatches, useRounds, useStationSetups, type RoundRow } from '@/lib/api/schedule';
import { useEventStaff } from '@/lib/api/staff';
import { useStations } from '@/lib/api/stations';
import { useTeams } from '@/lib/api/teams';
import { STALE_DEVICE_MS, buildStationLive, liveGroupOf, liveStatusIcon, pickCurrentRound } from '@/lib/live/derive';
import { buildTimeline } from '@/lib/live/timeline';
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

  const { data: stations, isLoading: stationsLoading } = useStations(eventId);
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
  const { data: liveStates } = useMatchLiveStates(eventId);
  const { data: teamVisits } = useTeamVisits(eventId);
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
  // Karte beantwortet "wo", Zeitleiste beantwortet "wie weit sind wir".
  const [view, setView] = useState<'map' | 'timeline'>('map');
  const [ganttMode, setGanttMode] = useState<GanttMode>('station');

  const buildRows = useCallback(
    (round: RoundRow | null, followProgress = false) =>
      buildStationLive({
        stations: stations ?? [],
        round,
        rounds: rounds ?? [],
        followProgress,
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
        liveStates: liveStates ?? [],
        now,
      }),
    [stations, rounds, blocks, stationSetups, matches, matchParticipants, teams, eventGames, activeCheckins, deviceSync, openSubmissions, currentResultValues, liveStates, now],
  );
  // Ansicht „Jetzt“ folgt dem tatsächlichen Fortschritt je Station; eine
  // angeblätterte Runde zeigt den Plan dieser Runde.
  const followingNow = selectedRoundId === null;
  const rows = useMemo(() => buildRows(selectedRound, followingNow), [buildRows, selectedRound, followingNow]);
  // Der Sperrbildschirm folgt immer der aktuellen Runde, auch wenn hier eine andere angeblättert ist.
  const currentRows = useMemo(
    () => (followingNow ? rows : buildRows(currentRound, true)),
    [rows, buildRows, followingNow, currentRound],
  );

  const timeline = useMemo(
    () =>
      buildTimeline(
        {
          rounds: rounds ?? [],
          blocks: blocks ?? [],
          stationSetups: stationSetups ?? [],
          stations: stations ?? [],
          matches: matches ?? [],
          participants: matchParticipants ?? [],
          teams: teams ?? [],
          visits: teamVisits ?? [],
          liveStartedAt: Object.fromEntries((liveStates ?? []).map((s) => [s.match_id, s.started_at])),
        },
        now,
      ),
    [rounds, blocks, stationSetups, stations, matches, matchParticipants, teams, teamVisits, liveStates, now],
  );

  const currentRoundIndex = currentRound ? playRounds.findIndex((r) => r.id === currentRound.id) : -1;
  const firstRound = playRounds[0];
  const lastRound = playRounds[playRounds.length - 1];
  // Läuft vom Start der ersten Runde, bis die letzte Runde vorbei ist und keine Station mehr offen ist.
  const eventInProgress =
    event?.status !== 'draft' &&
    Boolean(firstRound && lastRound) &&
    now.getTime() >= new Date(firstRound.starts_at).getTime() &&
    (now.getTime() <= new Date(lastRound.ends_at).getTime() ||
      currentRows.some((r) => liveGroupOf[r.status] === 'attention' || liveGroupOf[r.status] === 'running'));

  useEventHealthLiveActivity({
    enabled: eventInProgress,
    // Name steckt in den unveränderlichen Attributen; leere Daten (z. B. kurz nach dem Aufwachen) nicht anzeigen.
    ready: Boolean(event) && currentRows.length > 0,
    eventName: event?.name ?? '',
    rows: currentRows,
    roundLabel: currentRoundIndex >= 0 ? `Runde ${currentRoundIndex + 1} von ${playRounds.length}` : null,
    roundEndsAt: currentRound?.ends_at ?? null,
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
      icon: liveStatusIcon[r.status],
      badge: r.openSubmissions.length > 0 ? '!' : undefined,
      scoreLabel: r.scoreLabel ?? undefined,
      selected: r.station.id === selectedStationId,
    }));

  const legend = (
    <MapLegend present={visibleRows.map((r) => r.status)} showScore={visibleRows.some((r) => Boolean(r.scoreLabel))} />
  );

  const selectedRow = rows.find((r) => r.station.id === selectedStationId) ?? null;
  const bounds = event ? venueBoundsFromEvent(event) : null;
  const unplacedCount = rows.filter((r) => r.station.latitude === null || r.station.longitude === null).length;
  // Tabwechsel, keine Vertiefung: navigate statt push.
  const openResults = (matchId?: string) => router.navigate(matchId ? { pathname: '/results', params: { matchId } } : '/results');

  const statusBar = (
    <LiveStatusBar
      connected={connected}
      hasNext={roundIndex >= 0 && roundIndex < playRounds.length - 1}
      hasPrev={roundIndex > 0}
      isCurrent={!selectedRound || selectedRound.id === currentRound?.id}
      lastUpdated={lastUpdated}
      now={now}
      onNext={() => roundIndex < playRounds.length - 1 && setSelectedRoundId(playRounds[roundIndex + 1].id)}
      onNow={() => setSelectedRoundId(null)}
      onOpenDevices={() => router.navigate('/more/devices')}
      onOpenSchedule={() => router.navigate('/planning/schedule')}
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

  const viewSwitch = (
    <ViewSwitch
      accessibilityLabel="Ansicht"
      onChange={setView}
      options={[
        { value: 'map', label: 'Karte', icon: 'map-pin' },
        { value: 'timeline', label: 'Zeitleiste', icon: 'clock' },
      ]}
      value={view}
    />
  );

  const timelinePanel = (
    <TimelinePanel
      mode={ganttMode}
      now={now}
      onModeChange={setGanttMode}
      onSelectStation={setSelectedStationId}
      selectedStationId={selectedStationId}
      timeline={timeline}
      timezone={event?.timezone ?? 'Europe/Berlin'}
    />
  );

  const list = (
    <View className="gap-3">
      <LiveFilterChips onChange={setFilter} rows={rows} value={filter} />
      {visibleRows.length === 0 ? (
        <Card variant="muted">
          <Text className="text-center text-[13px] text-subtle">
            {filter === 'attention' ? 'Nichts braucht gerade Aufmerksamkeit.' : 'Keine Stationen in dieser Auswahl.'}
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

  // Erst laden, dann „leer“ sagen: vorher erschien nach jedem Neuladen kurz
  // „Noch keine Stationen – anlegen“, obwohl es welche gab.
  if (stationsLoading) {
    return (
      <Screen>
        <Header eyebrow="VERANSTALTUNGSTAG" title="Live-Betrieb" />
        <View className="items-center py-10">
          <ActivityIndicator accessibilityLabel="Live-Daten werden geladen" color={tokens.primary} />
        </View>
      </Screen>
    );
  }

  if ((stations ?? []).length === 0) {
    return (
      <Screen>
        <Header eyebrow="VERANSTALTUNGSTAG" title="Live-Betrieb" />
        <Card>
          <EmptyState
            action={<Button label="Stationen anlegen" onPress={() => router.navigate('/planning/venue')} size="sm" />}
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
        {viewSwitch}
        {view === 'map' ? (
          <Card className="overflow-hidden" style={{ gap: 0, padding: 0 }}>
            <SatelliteMap
              bounds={bounds}
              height={Math.max(260, Math.round(windowHeight * 0.4))}
              onPinPress={setSelectedStationId}
              pins={pins}
              fitToPins
              scrollWheelZoom={false}
            />
            {legend}
          </Card>
        ) : (
          timelinePanel
        )}
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
      {viewSwitch}
      <View className="flex-row items-start gap-5">
        <View className="min-w-0 flex-1" style={stickyStyle}>
          {view === 'map' ? (
            <Card className="overflow-hidden" style={{ gap: 0, padding: 0 }}>
              <SatelliteMap bounds={bounds} height={mapHeight} onPinPress={setSelectedStationId} fitToPins pins={pins} scrollWheelZoom={false} />
              {legend}
            </Card>
          ) : (
            timelinePanel
          )}
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
