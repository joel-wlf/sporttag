# Sporttag

Eine gemeinsame Expo-Anwendung für iOS, Android und Web zur Planung und Durchführung von Sporttagen auf Jugendfreizeiten. Sie richtet sich an **Stationsmanager und das Backoffice** und muss nach einmaliger Vorbereitung ohne Internet funktionieren.

## Zuerst lesen

Für Agents gelten die Arbeitsregeln in [AGENTS.md](AGENTS.md), einschließlich der Pflicht, diese README und alle drei Konzepte vor der Arbeit vollständig zu lesen.

| Dokument | Inhalt |
|---|---|
| [Frontend-Architektur](docs/frontend-architektur.md) | Stack, gluestack-ui/NativeWind-Designsystem, Context7-Dokumentation, native Navigation, Plattformfunktionen und Figma-Regeln |
| [Datenkonzept und ER-Modell](docs/datenkonzept.md) | Entitäten, Wertung, Codezugang, Check-ins, Offline-Synchronisierung, Karte und Werkzeuge |
| [Designsystem und Referenzen](docs/design-system.md) | Verbindliche Farbpalette, Layout-/Komponentenstil und vier gesicherte Originalbilder |
| [Agent-Arbeitsregeln](AGENTS.md) | Pflichtlektüre, verbindliche Leitlinien, Verifikation und Dokumentationspflege |

## Produkt und Ablauf

Stationsmanager geben einen gemeinsamen Veranstaltungscode ein und melden sich als Person an, nicht als Station: Sie wählen ihren Namen aus der Betreuungsliste. Der Startbildschirm ist der Tagesplan mit allen Blöcken und Pausen, auch an anderen Stationen. Check-in und Check-out erfolgen je Block an der Station (nur ein aktiver Check-in gleichzeitig); beim Einchecken zeigt die Geländeübersicht nur die eigene Zielstation auf einer großen Karte. Danach öffnen sie Matches, Regeln, Sync und Hilfe. Check-ins, Matchstatus und angenommene Ergebnisse sollen über Supabase Realtime live aktualisiert werden, damit mehrere Stationsleiter an derselben Station jeweils ihr eigenes Gerät nutzen können.

Das separat geschützte Backoffice verwaltet Veranstaltungen, Teams, feste Stationsstandorte, Spiele, Blöcke, Runden, Betreuung und konfigurierbare Tabellenpunkte. Mehrere Personen dürfen dieselbe Station betreuen. Mehrteamspiele sind optional; ein Abschlussspiel ist nicht vorgeschrieben. Öffentliche Teilnehmeransichten gehören derzeit nicht zum App-Umfang.

Ergebnisse sollen zuerst dauerhaft lokal gesichert und bei Verbindung automatisch synchronisiert werden. Ein vollständiger Abgleich erst am Ende muss möglich sein. Die App erhält Live-Updates über Supabase Realtime; Realtime ergänzt die persistente Synchronisierung und ersetzt sie nicht. Die Hilfeaktion startet einen nativen Anruf auf konfigurierte Rufnummern und zeigt ehrlich an, ob der Anruf gestartet werden konnte.

## Architekturvorgaben

- **React Native, Expo und TypeScript** für eine gemeinsame Anwendung.
- **Expo Router** mit nativer Navigation und plattformgerechtem Verhalten.
- **Natives Liquid Glass auf unterstützten iOS-Versionen**, integriert mit gluestack-ui und bei Bedarf `expo-glass-effect`; passende Fallbacks auf anderen Plattformen.
- **gluestack-ui als Komponentenbasis und NativeWind für Styling**, angepasst an das gemeinsame Designsystem. Aktuelle Dokumentation über Context7: `/gluestack/gluestack-ui`.
- **React Native Web / Expo Web** für Web und das responsive Backoffice.
- **Supabase** als Backend und **EAS** für native Builds.
- Figma liefert **UX-Struktur und Absicht**, keine pixelgenaue Kopiervorlage.

Gemeinsame visuelle Identität und gezielte native Plattformfähigkeiten gehören zusammen. shadcn/ui ist kein primäres UI-Framework.

## Tatsächlicher Implementierungsstand

Das Repository enthält ein Expo-Grundgerüst mit Router, Login-/Session-Grundlagen, Supabase-Client, Theme und EAS-Konfiguration. NativeWind und gluestack-ui sind installiert und bilden das gemeinsame Designsystem unter `components/ui/` und `components/layout/`. Das Backoffice ist entlang des Event-Lebenszyklus gegliedert (Events → Planung mit Teams, Spiele & Wertung, Gelände & Stationen, Zeitplan & Matches, Betreuung → Freigabe & Veröffentlichung → Live-Betrieb → Ergebnisse & Tabelle → Geräte & Synchronisierung sowie Spielvorlagen, Event-Einstellungen und Konto). Zusätzlich existiert unter `app/(station)/` ein ausgearbeitetes UI für die Stationsgeräte: Codebeitritt, Personenauswahl, Tagesplan als swipebarer Tagesüberblick mit vollständiger Zeitleiste, Geländeübersicht mit Check-in vor Ort und ein Cockpit mit Matches, Ergebniserfassung (Zählwert, Ausgang und Mehrteam-Platzierung), Werkzeugen, Regeln und echtem Sync-Status. Der Tagesplan zeigt alle Blöcke und Pausen einschließlich Blöcken ohne Einsatz; jeder Block bleibt unabhängig von der Uhrzeit auswählbar, sodass Verzögerungen und falsche Check-ins korrigierbar sind. Der Check-in liegt im `StationSessionProvider`: immer nur einer gleichzeitig, jederzeit wechselbar und über „Auschecken“ auf Tagesplan und Karte wieder lösbar. Der Stationsbereich ist bewusst minimalistisch gehalten: keine erklärenden Texte oder Entwicklungsstand-Badges auf den Screens, jede Fläche zeigt Daten oder eine Aktion. Das fachliche Supabase-Schema liegt als erste Migration unter `supabase/migrations/`; es umfasst RLS, versionierte Ergebnisabgaben, Ranglistenviews und die Realtime-Publication.

Das Backoffice ist jetzt an das echte Supabase-Schema angebunden (`@tanstack/react-query` über `lib/api/*`, `providers/ActiveEventProvider.tsx` für die ausgewählte Veranstaltung). Organisatoren können Veranstaltungen anlegen, Stammdaten und Status pflegen, einen Veranstaltungscode erzeugen/rotieren/widerrufen, Gerätezugänge widerrufen, weitere Organisatoren per E-Mail hinzufügen, Entwürfe löschen sowie den vollständigen Planungsweg bedienen: Teams, Wertungsregeln und Event-Spiele (inklusive Kopie aus der Spielvorlagen-Bibliothek), Stationen mit WGS84-Koordinaten, Blöcke/Runden/Stationsbelegungen/Matches mit Teamzuordnung, Betreuungszuordnung je Stationsbelegung, eine Bereitschaftsprüfung (`check_event_readiness`) und die Veröffentlichung (`publish_event`). Die Migration `supabase/migrations/20260921131505_backoffice_rpcs_full.sql` ergänzt dafür: automatische Profilanlage per Trigger auf `auth.users`, die Statusmaschine der Veranstaltung, Planungsintegrität (Blocküberschneidungen, Rundengrenzen, Team-Doppelbuchung je Runde), den per Vault-Secret gehashten Veranstaltungscode (`rotate_access_code`/`redeem_access_code` mit Rate-Limit) und `delete_draft_event`. Das Modul **Geräte & Synchronisierung** (`app/(backoffice)/more/devices.tsx`) ist jetzt vollständig: `device_sync_overview` zeigt je Gerät Planversion, letzten Kontakt, gemeldete/fehlende Sequenzen und Konfliktzahlen (per Realtime auf `event_device_states`, `result_submissions`, `station_checkins`, `device_event_access` live aktualisiert), Geräte lassen sich als nicht erwartet markieren oder ihr Zugang widerrufen, und eine Abgleichsprüfung (`check_event_reconciliation`/`confirm_event_reconciliation`) fasst zusammen, ob alle erwarteten Geräte ihr Abschlussmanifest bestätigt haben. Konfliktbearbeitung selbst bleibt Aufgabe des Live-Moduls (bisher Platzhalter). 

Der Stationsbereich ist jetzt an das echte Supabase-Schema angebunden. Ein neues Migrationspaar (`supabase/migrations/20260921201404_station_runtime.sql`, `20260921202849_fix_redeem_access_code_profile_fk.sql`) ergänzt `get_station_package` (ein konsistenter Offline-Paket-Snapshot), `sync_station_checkin`, eine überarbeitete `submit_result` (Korrekturen mit `base_result_version > 0` laufen jetzt immer als `needs_review` statt automatisch übernommen zu werden), `report_device_state`, `submit_device_manifest`, `check_event_reconciliation`/`confirm_event_reconciliation`/`set_device_expected` und `device_sync_overview`; außerdem einen Fix für einen beim Testen gefundenen Fremdschlüsselfehler (`devices.registered_by` durfte bei anonymen Stationssitzungen nie gesetzt werden). Der lokale Speicher liegt unter `lib/station/`: `store.ts` nutzt `expo-sqlite` (WAL, `synchronous=FULL`) und speichert eine Ergebnisabgabe zusammen mit Sequenznummer und Outbox-Eintrag in einer Transaktion, bevor die UI „Auf Gerät gespeichert“ zeigt; `store.web.ts` ist ein AsyncStorage-Fallback mit derselben Schnittstelle und **nicht** für verlässliche Offline-Ergebnissicherung qualifiziert. `identity.ts` übernimmt anonyme Anmeldung und Codebeitritt (`redeem_access_code`), `package.ts` lädt/prüft/speichert das Offline-Paket und ersetzt `demoData.ts` (entfernt) durch echte Auswahlfunktionen für Tagesplan, Matches und Regeln, `scoring.ts` baut die Ergebnis-Payload inklusive abgeleiteter Platzierung, `sync.ts` leert die Outbox mit Backoff bei jedem App-Start, Vordergrundwechsel, 30-Sekunden-Intervall und manuell, und `realtime.ts` abonniert Matches/Ergebnisse/Check-ins des Events sowie die geteilten Live-Zwischenstände. Bei jeder Ergebniseingabe meldet das Gerät über `sync_match_live` (`supabase/migrations/20260921210000_match_live_state.sql`, Tabelle `match_live_states`) einen fortlaufenden Live-Zwischenstand und markiert das Match als `in_progress`: Das Backoffice zeigt dadurch „läuft“ und den mitlaufenden Punktestand, ohne dass die revisionsbasierte Abgabe, ein Konflikt oder ein Korrekturvorschlag berührt wird. Mehrere Geräte derselben Station teilen einen Stand: Zählerstände werden je Team zusammengeführt (Migration `20261003150000_live_counter_merge`, `lib/station/liveMerge.ts`; auch für Mehrteamspiele mit Zahlwert, bei denen aus den Zählerständen die Platzierung entsteht), Ausgang und Platzierungen sind Last-Write-Wins; die verbindliche Wertung entsteht weiterhin nur über `submit_result`. `providers/StationSessionProvider.tsx` ist entsprechend neu geschrieben und baut auf diesem Speicher auf, statt nur In-Memory-State zu halten. Offline getestet wurden bisher sieben SQL-Szenarien direkt gegen die Datenbank (Idempotenz bei Retry, Konflikt zweier Geräte, Korrektur als `needs_review`, Manifest mit erkannter Lücke) — echte Gerätetests für Absturz-/Neustart-Szenarien, stehen aus; Timer, Stoppuhr und Zähler werden inzwischen zeitstempelbasiert je Match lokal gesichert. Hilfeanrufe mit echten Rufnummern bestehen unverändert aus `lib/emergency.ts`. Ein bewusstes Verlassen der Veranstaltung löst nur Sitzung und Eventbindung und behält das Journal; zusätzlich gibt es an Personenauswahl, Beitritt und Sync-Screen ein bestätigtes „Gerät zurücksetzen“ (`clearAllStationData`), damit ein Gerät nie in einem Zustand ohne Ausweg festsitzt. Webexport und native Bundles für iOS und Android wurden gebaut; echte Gerätetests, natives Liquid Glass, Haptik und die Abnahme der Paketkombination stehen noch aus.

Der Zeitplan bietet im Web-Backoffice den Export „Laufzettel (Excel)“ (alle Teams in einer .xlsx, Blatt „Alle“ plus ein Blatt je Team; `lib/schedule/runsheet.ts`, Test `tests/runsheet.test.ts`).

Der Zeitplan wird jetzt als **Zeitleiste** statt als Uhrzeit geführt. Geplante Uhrzeiten werden am Sporttag ohnehin nicht eingehalten: Ein Block startet gemeinsam, eine Runde endet aber erst, wenn das letzte Spiel fertig ist — dadurch verschieben sich die Gruppen gegeneinander. Eine neue Migration (`supabase/migrations/20260922100000_team_station_visits.sql`, Tabelle `team_station_visits`, RPC `sync_team_visit`) führt deshalb einen Laufzettel je Gruppe: Am Kopf der Ergebnisseite checkt das Stationsgerät eine Gruppe mit einem Tipp ein, wenn sie ankommt, und schickt sie mit einem Tipp weiter (`components/station/ArrivalStrip.tsx`). Wie der Live-Zwischenstand läuft das fortlaufend, offline-fest und last-write-wins, ohne die revisionsbasierte Ergebnissicherung zu berühren; `get_station_package` liefert den Laufzettel und die tatsächlichen Match-Zeiten mit aus. Daraus leitet `lib/live/timeline.ts` Verzug gegenüber dem Plan, Wartezeit an der Station, Wegzeit zwischen Stationen und Leerlauf je Station ab. Der Live-Betrieb zeigt das als Gantt-Diagramm neben der Karte, umschaltbar nach Station oder nach Gruppe (`components/backoffice/live/TimelinePanel.tsx`): heller Balken = Plan, kräftiger Balken = Ist, die Lücke dazwischen ist der Overhead. Uhrzeiten treten überall zurück — ordnend sind Block und Runde, die Planzeit steht klein daneben und mit dem Zusatz „geplant ca.“.

Veröffentlichte und laufende Veranstaltungen bleiben jetzt vollständig bearbeitbar (Teams, Spiele & Wertung, Zeitplan, Einstellungen): Die frühere Sperre ist entfernt, und strukturelle Änderungen erhöhen automatisch `events.plan_version` (Migration `20260923104419_editable_published_events.sql`), damit Geräte das Offline-Paket beim nächsten Sync neu laden; Laufzeit-/Ergebnisänderungen lösen bewusst keine neue Planversion aus. Ergebnisse lassen sich jederzeit korrigieren, erstmalig manuell eintragen oder **weich löschen** (`withdraw_result`, Migration `20260923104425_withdraw_result.sql`): Das Match wird wieder geöffnet und zählt nicht mehr, die Revisions- und Abgabehistorie bleibt erhalten.

Ergebnisse und Laufzettel sind beim Umplanen serverseitig geschützt (`20260923141753_protect_match_history`): Matches mit Historie lassen sich nicht mehr aus dem Plan löschen oder umbesetzen, sondern werden im Live-Betrieb abgesagt. `submit_result` nimmt Abgaben jetzt auch an, wenn der Live-Start nie übertragen wurde (`20260923144836`, `20260923144918`). Die Backoffice-Navigation, Filter und Sheets sind in docs/frontend-architektur.md (Navigationsregeln im Backoffice) beschrieben.

Ein Stresstest am 23.09.2026 (iOS-Simulator mit simuliertem Offline-Betrieb, Backoffice im Browser, SQL-Proben) hat unter anderem einen Absturz der Zahleneingabe, eine blockierende Sync-Warteschlange, eine fehlerhafte Konfliktübernahme im Backoffice und eine falsche Standard-Platzierungswertung bei Mehrteamspielen gefunden und behoben; Details in docs/datenkonzept.md Abschnitt 8.10. Konflikte entstehen seitdem je Match (nur bei geänderter Station oder geänderten Teams) statt bei jeder Planänderung (Abschnitt 8.11). Messwerte lassen sich jetzt mit Nachkommastellen erfassen, der Live-Betrieb folgt in der Ansicht „Jetzt“ dem tatsächlichen Fortschritt je Station, und die Zeitleiste zeigt gespielte Matches auch ohne Laufzettel.

Das **Offline-Kartenbild** ist umgesetzt: Das Web-Backoffice backt aus dem Gelände-Rechteck ein georeferenziertes JPEG (Karte „Offline-Karte“ unter Gelände & Stationen), Stationsgeräte laden es zusammen mit dem Paket, prüfen die SHA-256-Prüfsumme und zeigen es zoombar mit den Stationspins ohne Netz (Migration `20260923174056_offline_map.sql`, `lib/maps/`, `lib/station/mapAsset.ts`). Auf dem iOS-Simulator wurde das Rendern geprüft; der komplette Weg Backen → Upload → Download auf einem Gerät steht noch aus. Das Web nutzt weiterhin die Online-Karte.

Öffentliche Rechtsseiten ohne Login und ohne Veranstaltungscode (Store-Pflicht): `/privacy` (Datenschutzerklärung) und `/support` (Support & Feedback per vorbereiteter E-Mail, die App überträgt selbst nichts) unter `app/(public)/`; die Routenwache lässt diese Gruppe durch. Verlinkt sind sie im Stationsbeitritt und unter Backoffice → Konto. Vor der Store-Einreichung müssen `EXPO_PUBLIC_SUPPORT_EMAIL` und `EXPO_PUBLIC_LEGAL_CONTROLLER` (Name und Anschrift) gesetzt sein (`lib/legal.ts`); der Text ist ein Entwurf und kein Rechtsrat. Für Apple dieselben URLs im Web-Deployment als Datenschutz- bzw. Support-URL eintragen und im App-Store-Connect-Datenschutzprofil „Daten werden nicht zur Nachverfolgung genutzt“ prüfen.

Dieses Grundgerüst ist noch keine für den Offline-Einsatz geprüfte Sporttag-App.

## Projektstruktur

```text
app/                     Expo-Router-Routen und Layouts
app/(backoffice)/        geschütztes Backoffice entlang des Event-Lebenszyklus
app/(backoffice)/planning/ Planungs-Hub und Unterseiten (Teams, Spiele, Gelände, Zeitplan, Betreuung)
app/(backoffice)/more/   Übersicht, Freigabe, Geräte, Event-Einstellungen, Spielvorlagen, Konto
app/(station)/           Stationsbetrieb: Codebeitritt, Auswahl, Karte, Check-in, Cockpit
components/ui/           gemeinsame Designsystem-Komponenten, Icon-Set und Theme-Tokens
components/layout/       Screen, Header, Section, ModuleScreen, Navigation und BackofficeShell
providers/               Session-Verwaltung, StationSessionProvider (Offline-Paket, Check-in, Sync)
hooks/                   gemeinsame Hooks
lib/                     unter anderem Supabase-Client
lib/station/              lokaler Stationsspeicher, Offline-Paket, Sync-Engine, Realtime
assets/branding/app-icon/ plattformspezifische App-Icon-Quellen und Exporte
assets/icons/             eigenständige UI-Symbole, darunter das Läufermotiv
docs/                    Frontend- und Datenkonzept
AGENTS.md                Arbeitsregeln für Agents
```

Die Navigation des Backoffice folgt dem Event-Lebenszyklus: konfigurieren → planen → veröffentlichen → betreiben → abgleichen. Auf breiten Bildschirmen zeigt die Shell eine seitliche, gruppierte Navigation. Auf Smartphones übernimmt die native Tab-Leiste aus `expo-router/unstable-native-tabs` (SF Symbols auf iOS, Material Symbols auf Android) mit den Hauptbereichen Events, Planung, Live, Ergebnis und Mehr; im Web wird dafür die JS-Tab-Leiste von Expo Router verwendet. Die Module Übersicht, Freigabe, Geräte, Event-Einstellungen, Spielvorlagen und Konto liegen im verschachtelten `more/`-Stack und sind dort unter „Mehr“ erreichbar. `unstable-native-tabs` ist als instabile API gekennzeichnet; die native Tab-Leiste wurde per Bundle-Export, aber noch nicht auf einem Gerät geprüft. Eine Event-Kontext-Route (`[eventId]`) wird mit dem Event-Portfolio und den Mitgliedschaften eingeführt.

Die App-Icon-Konfiguration liegt in `app.json`: iOS verwendet das Icon-Composer-Projekt, Android ein Adaptive Icon mit eigener Vordergrund- und Monochromebene, Web ein Favicon. Das Läufer-SVG unter `assets/icons/` ist davon getrennt und für die spätere Verwendung innerhalb der UI vorgesehen.

Die geplante Komponentenstruktur unter `components/ui/` und `components/layout/` ist angelegt. Bestehende Starter-Komponenten wurden in das gemeinsame Designsystem überführt; weitere Komponenten werden bei konkretem Bedarf ergänzt.

## Lokale Einrichtung

Benötigt werden eine zum verwendeten Expo-SDK passende Node.js-Version, npm und für Backend-Funktionen ein Supabase-Projekt. Der konfigurierte Paketstand steht in [package.json](package.json).

Abhängigkeiten installieren:

```bash
npm install
```

Sofern noch keine lokale `.env` existiert, aus der Vorlage anlegen:

```bash
cp .env.example .env
```

Die Vorlage verwendet derzeit diese Variablennamen:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_SUPPORT_EMAIL=support@example.com
EXPO_PUBLIC_LEGAL_CONTROLLER="Name, Straße Nr., PLZ Ort"
```

In `EXPO_PUBLIC_*` gehören ausschließlich für Clients bestimmte Konfigurationswerte und öffentliche Client-Schlüssel. Service-Role-Schlüssel und private Tokens bleiben serverseitig. Reale Zugangsdaten nicht committen. Die Rufnummern der Hilfeaktionen „Assistenz“ und „Medizinisch“ stehen nicht mehr in der Umgebung, sondern je Veranstaltung in den Event-Einstellungen (`events.assistance_phone`, `events.medical_phone`); sie reisen im Offline-Paket mit.

Das Eintragen einer Projekt-URL richtet das im Datenkonzept beschriebene Schema und dessen Zugriffsregeln noch nicht ein.

## Entwicklung und Prüfungen

Vorhandene Startkommandos:

```bash
npm run start
npm run ios
npm run android
npm run web
```

Vorhandene Prüfkommandos:

```bash
npm run lint
npm run typecheck
npm run web:export
```

Der Webexport wird nach `dist/` geschrieben. Diese Kommandos ersetzen keine Gerätetests für Offline-Speicherung, Wiederherstellung und Synchronisierung. Die vorgesehenen Abnahmeszenarien stehen im Datenkonzept. Ihre Dokumentation bedeutet nicht, dass sie bereits implementiert oder bestanden sind.

## Native Builds und Veröffentlichung

[eas.json](eas.json) enthält die Profile `development`, `preview` und `production`. Für EAS-Builds sind EAS CLI, ein angemeldetes Expo-Konto und eine passende Projektkonfiguration erforderlich. Projekt- und App-Kennungen vor dem ersten Build prüfen.

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
eas build --profile production --platform ios
eas build --profile production --platform android
```

Für native Module und realistische Gerätetests passende Development Builds verwenden. Eignung für Expo Go hängt von den tatsächlich verwendeten Modulen ab.

Store-Veröffentlichungen erfordern die jeweiligen Apple-/Google-Zugänge und Konfiguration. EAS Submit und Web-Deployment sind separate Schritte; das Vorhandensein dieser Anleitung ist kein Auftrag zur Veröffentlichung.
