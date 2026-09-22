# Frontend-Architektur der Sporttag-App

Stand: 20.09.2026 · Verbindliche Vorgaben aus dem UI-Handover

Dieses Dokument ersetzt die vorherige Empfehlung, das gemeinsame Designsystem primär mit React Native `StyleSheet` umzusetzen. Es beschreibt die Zielarchitektur; die technische Umstellung ist begonnen. NativeWind und gluestack-ui sind installiert, und die gemeinsamen Komponenten unter `components/ui/` und `components/layout/` sind angelegt. Das übermittelte Handover endet bei `components/layout/Header.tsx`; weitere nicht übermittelte Vorgaben werden nicht vorausgesetzt.

## Leitprinzipien

**Native Navigation und Plattformverhalten, gemeinsames Anwendungsdesign.** Eine Expo-Anwendung bedient iOS, Android und Web. Markenbild, Farben, Typografie, Komponenten und fachliche Abläufe bleiben zusammenhängend. Navigation und Systemverhalten dürfen sich plattformgerecht unterscheiden.

**Gemeinsamer Kern mit gezielter Nutzung nativer Fähigkeiten.** Plattformfunktionen werden eingesetzt, wenn sie den Ablauf verbessern. Die gemeinsame Anwendung wird nicht auf den kleinsten gemeinsamen Funktionsumfang beschränkt. Nicht überall verfügbare Funktionen erhalten eine passende Alternative.

## Festgelegter Stack

| Bereich | Vorgabe |
|---|---|
| Anwendung | React Native, Expo, TypeScript |
| Navigation | Expo Router mit nativen Navigationsprimitiven |
| Styling | NativeWind |
| UI-Komponenten | gluestack-ui als Basis des gemeinsam genutzten Designsystems |
| Web | React Native Web / Expo Web |
| Backend | Supabase |
| Native Builds | EAS |

shadcn/ui ist kein primäres UI-Framework. Eine zweite, unabhängige Designsprache für Web wird nicht eingeführt. Die vorhandene Expo-Version und die dazu passenden Bibliotheksversionen werden vor einer Installation geprüft; dieses Dokument legt keine ungeprüfte NativeWind-Version fest.

### gluestack-ui und Dokumentationszugriff

**gluestack-ui ist die gewählte Komponentenbasis** und ersetzt die bisherige gluestack-ui-Vorgabe. NativeWind bleibt das Stylingwerkzeug. Die bestätigte Farbpalette und die Screenshot-Referenzen stehen in [design-system.md](design-system.md) und sind für UI-Arbeit verbindlich zu lesen.

gluestack stellt anpassbare Komponentenquellen bereit. Nur benötigte Bausteine übernehmen und als Teil des gemeinsamen Projekt-Designsystems pflegen. Die Open-Source-Basis und kostenpflichtige Pro-Vorlagen sind getrennte Angebote; Pro-Vorlagen sind für den beschriebenen Umfang nicht vorausgesetzt. [gluestack Introduction](https://gluestack.io/ui/docs/home/overview/introduction)

Vor Integration oder Änderung die aktuellen Dokumente über **Context7** abfragen: `/gluestack/gluestack-ui`. Versionsspezifische Dokumentation verwenden und bei Lücken offizielle Quellen ergänzen. Das bestehende Expo-Projekt schrittweise integrieren, nicht durch einen neuen Starter ersetzen.

**Eingesetzte Versionen:** Die recherchierte v5-Dokumentation nennt Einschränkungen im Web-Unterbau mit NativeWind v5. Im Projekt sind deshalb feste, zueinander passende Versionen eingetragen: `nativewind` `5.0.0-preview.4` mit `react-native-css` `3.0.4`, Tailwind CSS `4.2.0` und `@gluestack-ui/core` `5.0.15`. Der Webexport (`npm run web:export`) baut mit dieser Kombination erfolgreich. Der vereinbarte Prüfschritt auf iOS und Android, einschließlich Tastaturbedienung, Fokus und nativer Integration, ist noch nicht ausgeführt; die Kombination ist daher noch nicht für alle Plattformen als abgenommen dokumentiert. [Installationshinweise v5](https://v5.gluestack.io/ui/docs/home/getting-started/installation)

Gemeinsame visuelle Identität und Informationsarchitektur bleiben maßgeblich; gluestack ersetzt weder Expo Router noch die Offline-Datenschicht.

### Datenschicht des Backoffice

`@tanstack/react-query` (`providers/QueryProvider.tsx`) verwaltet Cache, Ladezustände und Invalidierung für alle Backoffice-Screens; kleine typisierte Funktionen plus Hooks je Domäne liegen unter `lib/api/` (`events`, `settings`, `teams`, `games`, `stations`, `staff`, `schedule`, `templates`), Postgres-/PostgREST-Fehler werden in `lib/api/errors.ts` in deutsche Meldungen übersetzt. `providers/ActiveEventProvider.tsx` hält die aktuell gewählte Veranstaltung (persistiert in AsyncStorage) und liefert sie über `useActiveEvent()`; `components/backoffice/RequireEvent.tsx` blendet einen Leerzustand ein, solange keine Veranstaltung gewählt ist. `lib/database.types.ts` wird über die Supabase-MCP-Tools (`generate_typescript_types`) generiert und nicht von Hand gepflegt.

Anlegen und Bearbeiten läuft über `components/ui/FormSheet.tsx` (modales Formularblatt statt eigener Editor-Route) und `components/ui/ConfirmDialog.tsx` für bestätigungspflichtige Aktionen; beide sind plattformübergreifend über React Natives `Modal` umgesetzt, nicht über gluestack-Overlays. Formularkomponenten, die ihren Zustand aus einer bearbeiteten Datenbankzeile ableiten, tun das über einen von der Elternkomponente vergebenen `key` (z. B. `key={team?.id ?? 'new'}`) und `useState`-Lazy-Initializer statt über `useEffect` plus `setState`, wie es die ESLint-Regel `react-hooks/set-state-in-effect` verlangt.

## Navigation

Route-Hierarchie und Informationsarchitektur bleiben gemeinsam. Expo Router organisiert Codebeitritt, Stationswahl, Geländeübersicht, Stationsbetrieb, Matches und das getrennt geschützte Backoffice.

Das Backoffice ist nach dem Event-Lebenszyklus gegliedert: konfigurieren → planen → veröffentlichen → betreiben → abgleichen. Die geplanten Module sind Event-Portfolio, Event-Übersicht, Planung (Teams, Spiele & Wertung, Gelände & Stationen, Zeitplan & Matches, Betreuung), Freigabe & Veröffentlichung, Live-Betrieb, Ergebnisse & Tabelle, Geräte & Synchronisierung, Event-Einstellungen, Spielvorlagen und Konto. Die Navigation steht gruppiert in `components/layout/navigation.ts`. Auf breiten Bildschirmen rendert die Shell eine seitliche Navigation. Auf iOS und Android verwendet die Tab-Leiste `expo-router/unstable-native-tabs` mit SF Symbols beziehungsweise Material Symbols; im Web kommt die JS-Tab-Leiste von Expo Router zum Einsatz. Die sichtbaren Bereiche sind Events, Planung, Live, Ergebnis und Mehr; Übersicht, Freigabe, Geräte, Event-Einstellungen, Spielvorlagen und Konto liegen im verschachtelten `more/`-Stack, weil native Tabs keine versteckten, aber navigierbaren Ziele unterstützen. Freigabe, Ergebnisabgleich und Gerätevollständigkeit bleiben eigenständige Module statt verteilter Schaltflächen in CRUD-Screens. Die Event-Kontext-Route (`[eventId]`) folgt mit dem Event-Portfolio und den Mitgliedschaften. `unstable-native-tabs` ist als instabile API gekennzeichnet; die native Tab-Leiste wurde per Bundle-Export, aber noch nicht auf einem Gerät geprüft. Der Stationsbetrieb liegt in einer separaten Gruppe `(station)`, die ohne Organisatoren-Sitzung erreichbar ist und den Standard-Einstieg der App bildet. Angemeldet wird sich als **Person** (Name aus der Betreuungsliste), nicht als Station. Der Ablauf ist: Veranstaltungscode → eigenen Namen wählen → **Tagesplan als Home** mit allen Blöcken und Pausen, auch an anderen Stationen → Check-in/Check-out je Block → Geländeübersicht, die nur die eigene Zielstation groß zeigt → Cockpit mit Matches, Regeln, Sync und Hilfe; das Backoffice ist von dort erreichbar. Es kann immer nur ein Check-in gleichzeitig aktiv sein. Station und Spiel können je Block wechseln. Check-ins, Matchstatus und angenommene Ergebnisse werden über Supabase Realtime live aktualisiert, damit mehrere Stationsleiter an derselben Station jeweils ihr eigenes Gerät nutzen und denselben Stand sehen; Realtime ergänzt die Offline-Synchronisierung und ersetzt sie nicht. Dieses Grundgerüst verwendet dieselben Design-Tokens und Komponenten, enthält aber noch keine Daten- oder Offline-Logik.

- Native Stack-Navigation, native Übergänge und native Tabs werden bevorzugt, soweit für den jeweiligen Einsatz verfügbar und passend.
- iOS erhält unter anderem das native Zurückwischen und passende native Sheets.
- Android erhält korrektes System-Zurückverhalten und passende Systemintegration.
- Web erhält adressierbare URLs, Browserhistorie und eine responsive Navigation.
- Safe Areas und Tastaturverhalten werden plattformgerecht behandelt.
- Modals und Sheets nutzen passende native Mechanismen, ohne die fachlichen Abläufe je Plattform auseinanderzuziehen.

Die Forderung nach gemeinsamer Gestaltung ist kein Anlass, Navigation und Systemgesten vollständig in JavaScript nachzubauen.

## Gemeinsames Designsystem mit NativeWind

NativeWind ist der Standard für die Gestaltung der Anwendungsoberfläche. gluestack-ui liefert die bevorzugten grundlegenden Komponenten. Wiederverwendbare Projektkomponenten kapseln Varianten, Zustände, Abstände und Interaktionen. Screens setzen diese Komponenten zusammen, statt dieselben Gestaltungsvorschriften immer wieder selbst zu implementieren.

Gemeinsame Design-Tokens definieren Farben, Typografie, Abstände, Radien und semantische Zustände. Dazu gehören für den Sporttag insbesondere „auf Gerät gespeichert“, „Synchronisierung ausstehend“, „übertragen“ und „Klärung nötig“. Zustände werden zusätzlich zu Farben auch durch Text beziehungsweise Symbole vermittelt.

```text
components/
  ui/
    Button.tsx
    Card.tsx
    Input.tsx
    Badge.tsx
    Avatar.tsx
    GlassSurface.tsx
    EmptyState.tsx
    ListRow.tsx
    StatCard.tsx
    Icon.tsx
    theme.ts
  layout/
    Screen.tsx
    Section.tsx
    Header.tsx
    ModuleScreen.tsx
    navigation.ts
    BackofficeShell.tsx
```

Diese Struktur verwendet die vorgeschlagenen Bausteine aus dem Handover und integriert passende gluestack-Komponenten unter `components/ui/`. Sie ist angelegt. `components/ui/` stellt die gemeinsamen Projektkomponenten bereit und verwendet beziehungsweise exportiert passende gluestack-ui-Bausteine, ohne identische Komponenten doppelt zu implementieren. `Button` und `Input` bauen auf den gluestack-ui-Creatorn auf, `Icon` nutzt das bereits vorhandene `react-native-svg`. `ModuleScreen` stellt die geplanten Backoffice-Module als gekennzeichnete Platzhalter dar. Weitere Komponenten werden bei konkretem Bedarf ergänzt. Plattformdateien wie `.ios.tsx`, `.android.tsx` oder `.web.tsx` sind für gezielte Unterschiede möglich; ihre gemeinsame Schnittstelle bleibt gleich.

**iOS soll gluestack-ui mit echtem nativem Liquid Glass verwenden.** `GlassSurface` ist eine gemeinsame Komponente mit plattformgeeigneter Darstellung. Auf unterstützten iOS-Versionen wird der native Effekt gezielt für Navigation und geeignete schwebende Bedienelemente eingesetzt. Andere Plattformen und ältere iOS-Versionen erhalten eine zur selben Gestaltung passende Oberfläche. Inhalte, Hierarchie und Bedienung bleiben gemeinsam.

gluestack-ui-Komponenten sind nicht automatisch sämtlich Liquid-Glass-Komponenten. Native Tabs und Stack-Navigation bleiben bei Expo Router; inhaltliche Tabs aus einer Komponentenbibliothek ersetzen keine native App-Navigation. Zusätzliche Glasoberflächen werden über `expo-glass-effect` integriert; Expo SDK 57 dokumentiert dafür native `GlassView`-Unterstützung ab iOS 26. Verfügbarkeit, Bedienungshilfen und Fallback werden zur Laufzeit berücksichtigt. Ein gewöhnlicher Blur oder eine halbtransparente Fläche ist kein Nachweis für natives Liquid Glass. [Expo GlassEffect](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/)

Liquid Glass ersetzt nicht jede Inhaltsfläche: Spielstände, Texte und Eingaben müssen insbesondere draußen gut lesbar bleiben. Gemeinsame Tokens und gluestack-ui-Komponentenschnittstellen gelten weiterhin. Der vorhandene `expo-glass-effect`-Eintrag ist über `GlassSurface` angebunden und wird für die breite Sidebar verwendet; die native Tab-Leiste selbst stammt aus `unstable-native-tabs`. Eine vollständige Integration auf allen Geräten ist damit noch nicht nachgewiesen.

Dynamische Geometrie, beispielsweise transformierte Stationspins oder animierte Werte, kann ergänzend über berechnete Style-Props gesteuert werden. Das ersetzt NativeWind nicht als Stylingstandard.

## Umgang mit Figma

Figma-Entwürfe sind **UX-Skizzen und keine pixelgenauen Implementierungsvorgaben**. Sie vermitteln Informationsarchitektur, Bildschirmstruktur, Inhaltshierarchie, Gruppierung, relative Gewichtung, Navigationsideen, Komponentenabsicht, grobe räumliche Beziehungen und Nutzerabläufe.

Exakte Abstände und Maße, beliebige Farben, Platzhalterschriften, von Hand gezeichnete Bedienelemente, nachgezeichnete Systemoberflächen und als Rechtecke dargestellte Plattformkomponenten werden nicht blind übernommen.

Bei der Umsetzung gilt:

1. Zweck und Interaktionsabsicht des Screens verstehen.
2. Informationshierarchie und UX-Struktur bewahren.
3. Die Konzepte auf vorhandene Komponenten des gemeinsamen Designsystems abbilden.
4. Passende native Apple- beziehungsweise Plattformkomponenten bevorzugen, wo sie die Bedienung verbessern.
5. Die gemeinsame visuelle Sprache und NativeWind-Design-Tokens anwenden.
6. Abstände, Typografie und responsives Verhalten ausarbeiten und verbessern.
7. Angemessene Bewegung, Haptik und Plattformfunktionen ergänzen; Bedienbarkeit und reduzierte Bewegung berücksichtigen.
8. Gegen die UX-Absicht prüfen, nicht gegen eine pixelgenaue Kopie des Figma-Bildes.

Die fertige Oberfläche soll üblicherweise ausgearbeiteter als das Figma-Konzept wirken und dessen zugrunde liegende Struktur erhalten. Plattformgerechte Komponenten bleiben mit der gemeinsamen visuellen Identität vereinbar; aus einer iOS-Skizze entsteht nicht automatisch eine eigene Designsprache für jede Plattform.

### Figma-Komponentenquellen

Das offiziell verlinkte [gluestack-Figma-Kit](https://gluestack.io/ui/docs/home/getting-started/figma-ui-kit) kann als Komponentenbasis dienen. Sein Stand muss mit den tatsächlich eingesetzten Code-Komponenten abgeglichen werden. Farben, Typografie und Komponentencharakter folgen [design-system.md](design-system.md).

Für native iOS-Konzepte stehen zusätzlich Apples UI-Kits über die [Apple Design Resources](https://developer.apple.com/design/resources/) zur Verfügung. Auch mit einem Kit bleibt Figma eine UX-Skizze und keine pixelgenaue Implementierungsvorschrift. Bisher wurde kein Kit in eine Figma-Datei eingebunden.

## Anwendung auf den Sporttag

Der bestätigte Stationsablauf bleibt: Veranstaltungscode → eigenen Namen aus der Betreuungsliste wählen → Tagesplan (Home) mit allen Blöcken und Pausen → Check-in je Block an der Station → Geländeübersicht der Zielstation → Matches, Regeln und Werkzeuge → Ergebniserfassung.

Auf Smartphones stehen große bedienbare Flächen, klare Spielstände und sichtbare Speicherzustände im Vordergrund. Das Backoffice nutzt auf breiten Bildschirmen mehr Platz für Planung, Tabellen und Karten. Beide verwenden dieselben Design-Tokens und geeignete gemeinsame Komponenten.

Die Oberfläche liest aus dem lokalen Datenmodell. Speichern, Wiederherstellung und Synchronisation liegen außerhalb der UI-Komponenten. Ein Wechsel des Designs oder eine plattformspezifische Darstellung darf die Offline-Ergebnissicherung nicht verändern.

Die Geländeübersicht und Stationspins funktionieren mit dem vorbereiteten Offline-Kartenmaterial. Eine plattformspezifische Kartenbearbeitung im Backoffice ist möglich, solange sie dieselben Stationskoordinaten und Kartenstände erzeugt.

Umgesetzt ist die interaktive Planungskarte unter `components/map/` (`SatelliteMap.tsx` nativ über `@maplibre/maplibre-react-native`, `SatelliteMap.web.tsx` im Web über `Leaflet`, gemeinsame Typen/Geo-Hilfsfunktionen plattformneutral) mit offenen, tokenfreien Kartenquellen: Esri-World-Imagery-Satellitenkacheln plus die Esri-Referenzebene „World Boundaries and Places“ für Orts-/Straßennamen (beides öffentliche ArcGIS-Online-Dienste ohne Account), Ortssuche über Nominatim (OpenStreetMap). Keine API-Keys nötig. `components/backoffice/planning/VenueMap.tsx` ergänzt die Bedienung: Gelände-Rechteck per zwei Kartentipps zeichnen (`events.venue_north/south/east/west`) und Stationen per Kartentipp platzieren, alternativ weiterhin manuelle Koordinateneingabe im Formular. Ein früherer Anlauf mit Mapbox-Kacheln über `maplibre-gl` im Web wurde verworfen: Metros Web-Bundler kann maplibre-gl-js' Web-Worker-Datei nicht ausliefern, und mit hängenden Style-Ladezuständen war weder das Gelände-Rechteck noch Stationspins zuverlässig sichtbar. Leaflet kommt ohne Worker und ohne asynchrone Style-Auflösung aus.

Native Möglichkeiten wie Haptik, System-Dateifreigabe für Sicherungspakete oder lokale Timer-Benachrichtigungen sind sinnvolle Kandidaten, aber durch dieses Architektur-Handover noch keine einzeln beauftragten Funktionen. Sie werden bei ihrer Umsetzung auf Plattformverfügbarkeit und Offline-Verhalten geprüft.

## Abgrenzung zum aktuellen Projektstand

Expo Router, TypeScript, React Native Web, Supabase, NativeWind und gluestack-ui sind im vorhandenen Projekt installiert und konfiguriert. Die gemeinsamen Komponenten unter `components/ui/` und `components/layout/` sowie die semantischen Tokens in `global.css` sind angelegt; die Backoffice-Screens und der Login verwenden sie. Das Backoffice liest und schreibt inzwischen gegen das echte Supabase-Schema (Events anlegen/konfigurieren, vollständige Planung, Veröffentlichung, Geräte & Synchronisierung inklusive Abgleichsprüfung); die interaktive Planungskarte (Gelände-Rechteck, Stationspins) ist umgesetzt, das Backen eines versionierten Offline-Kartenassets (`event_maps`) für den Stationsbetrieb bleibt Platzhalter. Live-Betrieb (`app/(backoffice)/live.tsx`) ist umgesetzt: eine Satellitenkarte zeigt alle Stationen als farbige Status-Pins (Klärung nötig, verspätet, ohne Betreuung, Gerät ohne Meldung, läuft, bereit, fertig, abgesagt/keine Runde) mit dem aktuell angenommenen Punktestand als kleinem Chip darüber, sobald ein Ergebnis vorliegt (auch der laufende Zwischenstand vom Gerät); die Ableitung dafür liegt in `lib/live/derive.ts`. Ab etwa 1180 px Breite stehen Karte (beim Scrollen fixiert) und Stationsliste bzw. -detail nebeneinander, darunter gestapelt mit dem Stationsdetail als Sheet. Die Liste ist nach „Braucht Aufmerksamkeit“, „Läuft“, „Bereit“, „Fertig“ gruppiert, nennt je Station den Grund im Klartext und lässt sich über Zähl-Chips filtern; die Karte zoomt beim Mausrad nicht (die Seite scrollt) und wählt ihren Ausschnitt so, dass Gelände und alle Stationen sichtbar sind. Im Detail können Organisatoren eingreifen (Match absagen, wieder einplanen, manuell als laufend/beendet markieren), jeweils mit Pflichtbegründung, die an `matches.notes` protokolliert wird; eine Ergebniskorrektur selbst bleibt dem Modul Ergebnisse vorbehalten. Neben der Karte steht eine **Zeitleiste** als Gantt-Diagramm (`components/backoffice/live/TimelinePanel.tsx` und `TimelineGantt.tsx`, Ableitung in `lib/live/timeline.ts`), umschaltbar nach Station oder nach Gruppe: heller gestrichelter Balken = Plan, kräftiger Balken = tatsächliche Belegung aus dem Laufzettel der Gruppen, die Lücke dazwischen ist der Overhead — Leerlauf der Station bzw. Weg der Gruppe. Darüber stehen typischer Verzug, größter Verzug, wie viele Gruppen gerade warten und der Leerlauf gesamt. Uhrzeiten sind im Live-Betrieb und in der Stationsapp bewusst nachrangig: ordnend sind Block und Runde, die geplante Zeit steht klein daneben und mit dem Zusatz „geplant ca.“, weil eine Runde erst endet, wenn das letzte Spiel fertig ist (datenkonzept.md Abschnitt 11.7). Die Ansicht aktualisiert sich über Supabase Realtime auf `matches`, `result_revisions`, `result_submissions`, `station_checkins`, `match_live_states`, `team_station_visits` und `event_device_states` mit einem 60-Sekunden-Rückfall und warnt sichtbar, wenn erwartete Geräte länger nicht gemeldet haben. Eingehende ntfy-Hilfeanfragen sind noch nicht umgesetzt, weil es dafür noch keine Tabelle gibt. Ergebnisse & Tabelle (`app/(backoffice)/results.tsx`) ist umgesetzt: eine Ergebnisliste mit Filtern nach Status, Station, Runde und Team, ein Detail je Match (angenommenes Ergebnis, offene Abgaben mit Konfliktvergleich, Revisionshistorie, Abgabejournal) sowie eine berechnete Tabelle mit Rang, geteilten Plätzen bei Gleichstand und einer Punkte-Aufschlüsselung je Match, umschaltbar über Chips; die Ableitung dafür liegt in `lib/results/derive.ts`. Organisatoren können eine offene Abgabe übernehmen oder verwerfen sowie ein Ergebnis frei korrigieren, jeweils mit Pflichtbegründung — serverseitig über die RPCs `organizer_record_result` und `dismiss_submissions` (`supabase/migrations/20260922080158_results_module.sql`), die dafür auch den Organisatorpfad in `result_submissions` öffnen. Die Tabelle selbst liegt in der View `standings` (jetzt mit `rank`, `matches_played`, `wins`/`draws`/`losses`) über der neuen View `result_points`, die Rang und Aufschlüsselung aus derselben Punktelogik ableitet. Der Stationsbereich ist an das echte Supabase-Schema angebunden (`lib/station/`, siehe README und datenkonzept.md Abschnitt 8.2/8.4/8.5/11.2): Codebeitritt, Offline-Paket, Check-in und Ergebnisabgabe laufen über einen lokalen SQLite-Speicher mit Sync-Engine und Realtime-Abonnement; die Match-Ergebniseingabe meldet bei jeder Eingabe einen Live-Zwischenstand (`sync_match_live`), der das Match im Backoffice als „läuft“ zeigt und den Punktestand mitlaufen lässt, ohne einen Konflikt oder Korrekturvorschlag auszulösen. Am Kopf der Ergebnisseite führt `components/station/ArrivalStrip.tsx` den Laufzettel je Gruppe — *Eingetroffen* und *Ausschicken* als je ein Tipp, über `sync_team_visit` ebenfalls fortlaufend und offline-fest (datenkonzept.md Abschnitt 8.5/11.7); daraus entstehen Verzug, Wartezeit, Wegzeit und Leerlauf der Zeitleiste. die Stationskarte lädt weiterhin online (kein Offline-Kachel-Prefetch), und persistente Werkzeugzustände fehlen noch. Native Gerätetests für die Versionskombination und die Offline-Sicherung stehen aus.

Dieses Dokument beschreibt die Zielarchitektur und den erreichten Zwischenstand. Es nimmt keine Paketinstallation, SDK-Aktualisierung oder Deployment vor.
