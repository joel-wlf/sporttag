# Sporttag-App: ER-Modell und Datenkonzept

Stand: 21.09.2026 · Entwurf 4: Supabase-Schema und Realtime-Grundlage

Grundlage: `sporttag-app-datenmodell-handover.md`. Die Anforderungen daraus dienen als fachlicher Kontext. Dieses Dokument konzipiert das Modell; es implementiert weder Anwendung noch Datenbank. Mit **Default** markierte Entscheidungen sind Vorschläge, keine bereits bestätigten Anforderungen.

Die verbindliche Frontend-Zielarchitektur steht in [frontend-architektur.md](frontend-architektur.md): gemeinsame Expo-Anwendung, gluestack-ui als Komponentenbasis, NativeWind für das Designsystem und native Navigation mit Expo Router. Diese Architektur ändert die hier beschriebenen Offline- und Datenintegritätsanforderungen nicht.

## 1. Modell im Überblick

Ein Sporttag ist eine abgeschlossene Veranstaltung. Teams, Stationen, Zeitplan, Spielkonfiguration und Ergebnisse gehören genau zu dieser Veranstaltung. Wiederverwendbare Spielvorlagen und Organisatoren-Accounts bestehen veranstaltungsübergreifend. Die App richtet sich an Stationsmanager und das Backoffice. Öffentliche Ansichten für Teilnehmer gehören nach der jüngsten Präzisierung nicht zum aktuellen App-Umfang.

Stationsmanager treten über einen gemeinsamen Veranstaltungscode bei, beispielsweise sechsstellig, und benötigen keinen persönlichen Account. Sie melden sich als **Person** an, nicht als Station: Sie wählen ihren eigenen Namen aus der geplanten Betreuungsliste (`event_staff`); daraus leitet die App über `station_assignments` je Block die Station, das Spiel und die vorbeikommenden Gruppen ab. Der Startbildschirm zeigt den **vollständigen Tagesplan** mit allen Blöcken und Pausen, auch wenn andere Blöcke an einer anderen Station stattfinden oder ohne Einsatz sind. Eine Person kann dadurch in verschiedenen Blöcken an derselben oder an einer anderen Station eingesetzt sein. Check-in und Check-out erfolgen **je Block an der Station**; es kann immer nur **ein Check-in gleichzeitig** aktiv sein. Namen sind planbare Betreuungspersonen, keine Logins. Mehrere Personen und Geräte können dieselbe Station betreuen. Das Backoffice ist bestätigt separat für Organisatoren geschützt.

Jede Station hat einen festen Standort mit Geo-Koordinaten. Eine vorbereitete Satellitenübersicht mit Stationspins wird offline mitgeliefert. Beim Einchecken zeigt die Geländeübersicht nur die **eigene Zielstation** des aktuellen Blocks auf einer großen Karte, nicht alle Stationen. Danach sehen Stationsmanager Matches, Regeln, Timer, Stoppuhr und Zähler. Check-ins, Matchstatus und angenommene Ergebnisstände werden über **Supabase Realtime** live aktualisiert, damit mehrere Stationsleiter an derselben Station jeweils ihr eigenes Gerät nutzen und denselben Stand sehen. Realtime ergänzt die persistente Offline-Synchronisierung und ersetzt sie nicht; ohne Verbindung bleibt die lokale Sicherung maßgeblich. Für Assistenz- und medizinische Hilfe startet die App einen **nativen Anruf** auf die konfigurierten Rufnummern; ein nicht möglicher Anruf wird nie als erfolgreich angezeigt.

Eine **Stationsbelegung** verbindet Station, Block und Veranstaltungsspiel. Ein **Match** verbindet diese Belegung mit einer Runde. Seine Teams stehen in einer Teilnahmetabelle. Ergebnisse werden pro Match versioniert und enthalten für jedes teilnehmende Team einen Ergebniswert. Tabellenpunkte entstehen daraus anhand einer festgelegten Wertungsregel.

Bestätigt: Spielpunkte unterscheiden sich stark je Spiel. Die Gesamtwertung basiert deshalb standardmäßig auf Sieg/Unentschieden/Niederlage, nicht auf der Summe der Spielpunkte. Der Gesamtsieg ergibt sich aus der Tabelle. Optional sind Matches mit mehreren oder allen Teams möglich, beispielsweise das „Kamelspiel“. Sie können am Ende oder in einer beliebigen Spielrunde stattfinden. Ein Abschlussspiel ist keine Voraussetzung. Im Backoffice wird für solche Matches entweder nur der Gewinner oder eine Folge von Platzierungen mit Punkten belohnt.

**Offline ist verpflichtend:** Nach einmaliger Vorbereitung muss der gesamte Sporttagsbetrieb ohne Internet funktionieren, auch über App-Abstürze und Neustarts hinweg. Ergebnisse werden zuerst dauerhaft lokal gespeichert. Sobald Internet verfügbar ist, werden sie automatisch zur zentralen Datenbank übertragen. Ein einziger abschließender Synchronisationsdurchlauf je Erfassungsgerät muss ebenfalls ausreichen. **Bestätigt ist außerdem: Die App erhält Live-Updates über Supabase Realtime.** Realtime bleibt eine Ergänzung zur persistenten Synchronisation und keine Voraussetzung für den Offline-Betrieb.

Weitere Defaults: feste Teams ohne personenbezogene Teilnehmerverwaltung, manuelle Planung, zwei Teams in regulären Matches, eine Gesamtwertung und unmittelbare lokale Ergebnisbestätigung durch Spielleiter. Das Modell unterstützt ausdrücklich auch ein oder mehrere Teams pro Match. Bestätigt ist die freie Konfiguration der Tabellenpunkte im Backoffice; 3/1/0 ist lediglich ein vorbelegbarer Vorschlag.

## 2. ER-Diagramm

`||` bedeutet genau eins, `o|` null oder eins, `o{` null bis viele. Entwürfe dürfen zunächst unvollständig sein; strengere Mindestzahlen gelten beim Veröffentlichen oder Abschließen.

```mermaid
erDiagram
    AUTH_USERS ||--o| PROFILES : besitzt
    PROFILES ||--o{ EVENT_MEMBERSHIPS : hat
    EVENTS ||--o{ EVENT_MEMBERSHIPS : berechtigt
    PROFILES ||--o{ GAME_TEMPLATES : verwaltet
    EVENTS ||--o{ TEAMS : umfasst
    EVENTS ||--o{ STATIONS : umfasst
    EVENTS ||--o{ EVENT_GAMES : konfiguriert
    GAME_TEMPLATES o|--o{ EVENT_GAMES : liefert_Vorlage
    EVENTS ||--o{ SCORING_RULES : definiert
    SCORING_RULES o|--o{ EVENTS : ist_Default
    SCORING_RULES o|--o{ EVENT_GAMES : ueberschreibt_Default
    EVENTS ||--o{ BLOCKS : plant
    BLOCKS ||--o{ ROUNDS : gliedert
    BLOCKS ||--o{ STATION_SETUPS : belegt
    STATIONS ||--o{ STATION_SETUPS : wird_belegt
    EVENT_GAMES ||--o{ STATION_SETUPS : wird_gespielt
    EVENTS ||--o{ EVENT_STAFF : plant_Personen
    EVENT_STAFF ||--o{ STATION_ASSIGNMENTS : betreut
    STATION_SETUPS ||--o{ STATION_ASSIGNMENTS : wird_betreut
    EVENTS ||--o{ EVENT_ACCESS_CODES : erlaubt_Beitritt
    EVENTS ||--o{ DEVICE_EVENT_ACCESS : gibt_Geraetezugang
    AUTH_USERS ||--o{ DEVICE_EVENT_ACCESS : technische_Identitaet
    DEVICES ||--o{ DEVICE_EVENT_ACCESS : nutzt
    EVENT_ACCESS_CODES o|--o{ DEVICE_EVENT_ACCESS : erteilt
    DEVICE_EVENT_ACCESS ||--o{ STATION_CHECKINS : meldet_sich_an
    STATION_SETUPS ||--o{ STATION_CHECKINS : wird_betreut
    STATION_CHECKINS ||--o{ CHECKIN_STAFF : benennt
    EVENT_STAFF ||--o{ CHECKIN_STAFF : ist_vor_Ort
    EVENTS ||--o{ EVENT_MAPS : besitzt_Kartenstaende
    EVENT_MAPS o|--o| EVENTS : aktive_Karte
    ROUNDS ||--o{ MATCHES : enthaelt
    STATION_SETUPS ||--o{ MATCHES : beherbergt
    SCORING_RULES o|--o{ MATCHES : konkretisiert_Wertung
    MATCHES ||--o{ MATCH_PARTICIPANTS : hat
    TEAMS ||--o{ MATCH_PARTICIPANTS : spielt
    MATCHES ||--o{ RESULT_REVISIONS : dokumentiert
    PROFILES o|--o{ RESULT_REVISIONS : erfasst
    RESULT_REVISIONS ||--o{ RESULT_VALUES : enthaelt
    MATCH_PARTICIPANTS ||--o{ RESULT_VALUES : erhaelt
    PROFILES o|--o{ DEVICES : registriert
    EVENTS ||--o{ EVENT_DEVICE_STATES : erwartet_Synchronisation
    DEVICES ||--o{ EVENT_DEVICE_STATES : meldet_Stand
    MATCHES ||--o{ RESULT_SUBMISSIONS : empfaengt
    DEVICES ||--o{ RESULT_SUBMISSIONS : liefert
    PROFILES o|--o{ RESULT_SUBMISSIONS : uebermittelt
    RESULT_SUBMISSIONS ||--o| RESULT_REVISIONS : erzeugt
    DEVICE_EVENT_ACCESS o|--o{ RESULT_SUBMISSIONS : berechtigt_Geraet
    STATION_CHECKINS o|--o{ RESULT_SUBMISSIONS : dokumentiert_Kontext

    EVENTS {
        uuid id PK
        text name
        date event_date
        text timezone
        text status
        uuid default_scoring_rule_id FK
        int plan_version
        uuid active_map_id FK
        text ntfy_base_url
        text ntfy_topic
    }
    AUTH_USERS {
        uuid id PK
    }
    PROFILES {
        uuid id PK,FK
        text display_name
    }
    EVENT_MEMBERSHIPS {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        text role
        boolean active
    }
    GAME_TEMPLATES {
        uuid id PK
        uuid owner_id FK
        text name
        text rules
        text measurement_type
        jsonb tools_config
    }
    TEAMS {
        uuid id PK
        uuid event_id FK
        text name
        int number
        text color
    }
    STATIONS {
        uuid id PK
        uuid event_id FK
        text name
        text location
        decimal latitude
        decimal longitude
        text arrival_notes
    }
    EVENT_GAMES {
        uuid id PK
        uuid event_id FK
        uuid template_id FK
        uuid scoring_rule_id FK
        text name
        text measurement_type
        text comparison_direction
        int min_teams
        int max_teams
        jsonb tools_config
    }
    SCORING_RULES {
        uuid id PK
        uuid event_id FK
        text name
        text mode
        jsonb config
    }
    BLOCKS {
        uuid id PK
        uuid event_id FK
        text kind
        int position
        timestamptz starts_at
        timestamptz ends_at
    }
    ROUNDS {
        uuid id PK
        uuid event_id FK
        uuid block_id FK
        text kind
        int position
        timestamptz starts_at
        timestamptz ends_at
    }
    STATION_SETUPS {
        uuid id PK
        uuid event_id FK
        uuid block_id FK
        uuid station_id FK
        uuid event_game_id FK
    }
    STATION_ASSIGNMENTS {
        uuid id PK
        uuid event_id FK
        uuid staff_id FK
        uuid station_setup_id FK
    }
    EVENT_STAFF {
        uuid id PK
        uuid event_id FK
        text display_name
    }
    EVENT_ACCESS_CODES {
        uuid id PK
        uuid event_id FK
        text code_digest UK
        timestamptz valid_until
        timestamptz revoked_at
    }
    DEVICE_EVENT_ACCESS {
        uuid id PK
        uuid event_id FK
        uuid device_id FK
        uuid auth_user_id FK
        uuid access_code_id FK
        timestamptz granted_at
        timestamptz revoked_at
    }
    STATION_CHECKINS {
        uuid id PK
        uuid event_id FK
        uuid station_setup_id FK
        uuid device_access_id FK
        timestamptz checked_in_at
        timestamptz checked_out_at
    }
    CHECKIN_STAFF {
        uuid checkin_id PK,FK
        uuid staff_id PK,FK
        uuid event_id FK
    }
    EVENT_MAPS {
        uuid id PK
        uuid event_id FK
        int version
        text asset_path
        text content_hash
        text projection
        decimal north
        decimal south
        decimal east
        decimal west
    }
    MATCHES {
        uuid id PK
        uuid event_id FK
        uuid round_id FK
        uuid station_setup_id FK
        uuid scoring_rule_id FK
        text status
        boolean counts_for_ranking
        int current_result_version
    }
    MATCH_PARTICIPANTS {
        uuid id PK
        uuid event_id FK
        uuid match_id FK
        uuid team_id FK
        int slot
    }
    RESULT_REVISIONS {
        uuid id PK
        uuid event_id FK
        uuid match_id FK
        int version
        uuid recorded_by FK
        timestamptz recorded_at
        text reason
        uuid request_id FK,UK
    }
    RESULT_VALUES {
        uuid revision_id PK,FK
        uuid participant_id PK,FK
        uuid event_id FK
        numeric measured_value
        int placement
    }
    DEVICES {
        uuid id PK
        uuid registered_by FK
        text label
        timestamptz last_seen_at
    }
    EVENT_DEVICE_STATES {
        uuid event_id PK,FK
        uuid device_id PK,FK
        int downloaded_plan_version
        bigint last_reported_sequence
        bigint final_sequence
        timestamptz reconciled_at
    }
    RESULT_SUBMISSIONS {
        uuid request_id PK
        uuid event_id FK
        uuid match_id FK
        uuid device_id FK
        uuid submitted_by FK
        uuid device_access_id FK
        uuid checkin_id FK
        bigint local_sequence
        int base_result_version
        int plan_version
        jsonb payload
        text payload_hash
        text status
        timestamptz captured_at
        timestamptz received_at
    }
```

Die direkten Event-Beziehungen indirekter Kindtabellen sind im Diagramm zur Lesbarkeit nicht nochmals eingezeichnet. Ihr `event_id` wird durch zusammengesetzte Fremdschlüssel abgesichert.

## 3. Datenkatalog

Konventionen: Alle `id` sind UUID-Primärschlüssel, sofern anders angegeben. Fremdschlüssel sind UUID. `?` bedeutet nullable, alle anderen Angaben sind Pflichtfelder, sofern kein Default genannt ist. Veränderliche Stammdaten erhalten `created_at` und `updated_at` als `timestamptz`. Ergebnisrevisionen sind unveränderlich. Status und Typen sind `text` mit definierten CHECK-Wertemengen. Fachliche Pflichtprüfungen dürfen beim Entwurf teilweise erst zur Veröffentlichung greifen.

| Entität | Zweck, Attribute und Schlüssel |
|---|---|
| `events` | Veranstaltung: `name text`, `motto text?`, `event_date date`, `timezone text` (Default `Europe/Berlin`), `status` (`draft/published/running/finished/archived`), `default_scoring_rule_id? → scoring_rules`, `plan_version int` Default 1, `active_map_id? → event_maps`, `venue_north/venue_south/venue_east/venue_west numeric?` (WGS84-Gelände-Rechteck, im Backoffice auf der interaktiven Planungskarte gezeichnet; alle vier gemeinsam gesetzt oder gemeinsam leer), `ntfy_base_url text?`, `ntfy_topic text?` (optionale Alternative). Wertungsregel und aktive Karte müssen vor Freigabe des Offline-Pakets gesetzt sein. Hilfe-/Notfallnummern liegen vorerst in der Umgebung des Geräts. |
| `profiles` | Nur persönliche Organisatorenprofile: `id` zugleich PK und FK zu `auth.users.id`, `display_name text`. Stationsmanager brauchen kein Profil. Zugangsdaten bleiben bei Auth. |
| `event_memberships` | Backoffice-Berechtigung: `event_id → events`, `user_id → profiles`, `role` zunächst ausschließlich `organizer`, `active boolean` Default true. UNIQUE `(event_id,user_id)`. Stationsbetreuung wird unabhängig davon geplant. |
| `game_templates` | Wiederverwendbare Vorlage: `owner_id → profiles`, `name`, `description`, `rules`, `referee_notes`, `materials` als Text; optionale Beschreibungstexte dürfen leer sein. `default_duration_seconds int?`, `measurement_type` (`outcome/number`), `unit text?`, `comparison_direction` (`higher/lower`), `min_teams int` und `max_teams int` Default 2, `allow_ties boolean`, `tools_config jsonb` Default `[]` mit validierten Definitionen für Timer, Stoppuhr und Zähler. Zunächst private Vorlagen des Erstellers. |
| `event_games` | Historisch eigenständige Spielkopie: `event_id`, `template_id? → game_templates`; alle fachlichen Vorlagenattribute als Kopie, `scoring_rule_id? → scoring_rules` als Überschreibung. Eine Vorlage kann mehrere Varianten in einem Sporttag erzeugen. Dauer ist nur Planungsrichtwert. |
| `teams` | Feste Teams: `event_id`, `name text`, `number int?`, `color text?`, `participant_count int?`. UNIQUE `(event_id,name)` und `(event_id,number)` für gesetzte Nummern. Keine Personennamen erforderlich. |
| `stations` | Fester physischer Ort: `event_id`, `name text`, `location text?`, `notes text?`, `latitude numeric(9,6)`, `longitude numeric(10,6)` in WGS84, `arrival_notes text?`. UNIQUE `(event_id,name)`. Koordinaten gelten über alle Blöcke des Events; kein `game_id`. |
| `scoring_rules` | Unveränderliche Regel nach Veröffentlichung: `event_id`, `name text`, `mode` (`win_draw_loss/raw_value/placement`), `config jsonb`. Konfiguration hat ein festes Schema pro Modus, keine frei ausführbaren Formeln. |
| `blocks` | Grobe Zeitstruktur: `event_id`, `name text`, `kind` (`play/break/final/special`), `position int`, `starts_at/ends_at timestamptz`. UNIQUE `(event_id,position)`. Ein Pausenblock hat keine Runden oder Belegungen. |
| `rounds` | Zeitslot im Block: `event_id`, `block_id → blocks`, `label text`, `position int`, `kind` (`play/break`), `starts_at/ends_at timestamptz`. UNIQUE `(block_id,position)`. Pausenrunden erlauben ausdrücklich benannte Pausen innerhalb eines Spielblocks und enthalten keine Matches. |
| `station_setups` | Spiel pro Station und Block: `event_id`, `block_id → blocks`, `station_id → stations`, `event_game_id → event_games`, `notes text?`. UNIQUE `(block_id,station_id)`. |
| `event_staff` | Planbare Betreuungsperson ohne Account: `event_id`, `display_name text`, `notes text?`. Keine E-Mail, kein Passwort, kein verpflichtender Auth-FK. Gleiche Namen sind erlaubt und werden in der Planung unterscheidbar beschriftet. Spielleiter sind ebenfalls `event_staff`; ihre Zuständigkeit ergibt sich aus `station_assignments` je Block. |
| `station_assignments` | Geplante Betreuung: `event_id`, `staff_id → event_staff`, `station_setup_id → station_setups`. UNIQUE `(staff_id,station_setup_id)`. Joel und Elias sind zwei Zuordnungen derselben Belegung. Dies ist Einsatzplanung, keine individuelle Zugriffssperre. |
| `event_access_codes` | Serverinterner Zugangscode: `event_id`, `code_digest text` UNIQUE, `valid_until timestamptz`, `revoked_at timestamptz?`, `created_at`. Code als sechsstellige Zeichenfolge inklusive möglicher führender Nullen; nur der mit serverseitigem Geheimnis erzeugte Digest wird gespeichert. Ein aktiver Code pro Event, Rotation möglich. Clients können die Tabelle nicht auslesen. |
| `device_event_access` | Technischer Eventzugang: `event_id`, `device_id → devices`, `auth_user_id → auth.users`, `access_code_id? → event_access_codes`, `granted_at`, `revoked_at?`. Anonyme technische Auth-Identität statt persönlichem Stationsleiterkonto. Ein aktiver Zugang je `(event_id,device_id)`; Zugriff nur für die gebundene Auth-Identität. |
| `station_checkins` | Tatsächliche Übernahme je Block: `id` schon offline erzeugt, `event_id`, `station_setup_id → station_setups`, `device_access_id → device_event_access`, `checked_in_at`, `checked_out_at?`, `received_at?`. Check-in und Check-out erfolgen blockweise vom Tagesplan aus; je Gerät ist höchstens ein Check-in gleichzeitig aktiv (Wechsel erst nach Check-out bzw. automatischem Check-out des vorigen Blocks), mehrere Geräte an derselben Belegung sind erlaubt. Ortsnachweis ist nicht erforderlich. |
| `checkin_staff` | Angegebene Anwesende: PK `(checkin_id,staff_id)`, FKs zu Check-in und `event_staff`, zusätzlich `event_id`. Erlaubt Joel und Elias gemeinsam auf einem Gerät oder jeweils mit eigenem Gerät. Namen sind Selbstauskunft, keine verifizierte Identität. |
| `event_maps` | Offline-Kartenstand: `event_id`, `version int`, `asset_path text`, `content_hash text`, `mime_type text`, `width_px/height_px int`, `projection text` Default `EPSG:3857`, WGS84-Grenzen `north/south/east/west numeric`, `source_label text?`, `attribution text?`. UNIQUE `(event_id,version)`. Nordorientiertes, georeferenziertes Satellitenbild; Event referenziert den aktiven Stand. |
| `matches` | Konkrete Begegnung: `event_id`, `round_id → rounds`, `station_setup_id → station_setups`, `status` (`scheduled/ready/in_progress/completed/cancelled`), `scoring_rule_id? → scoring_rules`, `counts_for_ranking boolean` Default true, `notes text?`, `current_result_version int` Default 0. Regel wird bei Veröffentlichung verbindlich gesetzt. Planzeiten kommen aus der Runde; optionale `actual_started_at/actual_ended_at` erfassen tatsächliche Zeiten. |
| `match_participants` | n:m zwischen Matches und Teams: `event_id`, `match_id → matches`, `team_id → teams`, `slot int`. UNIQUE `(match_id,team_id)` und `(match_id,slot)`. Ein Slot ist nur Reihenfolge, kein neues Team. |
| `match_live_states` | Geteilter Live-Zwischenstand je Match: PK `match_id`, `event_id`, `values jsonb` (Array aus `{participant_id, measured_value?, placement?}`), `started_at timestamptz?`, `updated_at timestamptz`, `updated_by_device_id? → devices`. Fortlaufend, nicht revisionsbasiert; speist den mitlaufenden Punktestand und den Status „läuft“ im Backoffice. Mehrere Geräte derselben Station teilen einen Stand (Last-Write-Wins), ohne Konflikt oder Korrekturvorschlag. Lesen über `private.has_event_access`; Schreiben nur über `sync_match_live`. |
| `team_station_visits` | Laufzettel einer Gruppe an einer Station: PK `participant_id → match_participants`, `event_id`, `match_id → matches`, `team_id → teams`, `arrived_at timestamptz?`, `released_at timestamptz?`, `updated_at timestamptz`, `updated_by_device_id? → devices`. CHECK `released_at >= arrived_at`. Fortlaufend, nicht revisionsbasiert; Grundlage für Verzug, Wartezeit, Wegzeit und Leerlauf in der Zeitleiste (Abschnitt 11.7). Lesen über `private.has_event_access`; Schreiben nur über `sync_team_visit`. |
| `result_revisions` | Vollständiger zentral gültiger Ergebnisstand: `event_id`, `match_id → matches`, `version int`, `recorded_by? → profiles` nur bei Organisatoren, `recorded_at timestamptz` (Serverzeit), `reason text?`, `request_id → result_submissions.request_id` UNIQUE. UNIQUE `(match_id,version)`. Ab Version 2 ist ein Korrekturgrund erforderlich. Bei Stationsmanagern liefert die Abgabe Geräte-/Check-in-Kontext statt eines persönlichen Accounts. |
| `result_values` | Teamwert einer Revision: zusammengesetzter PK `(revision_id,participant_id)`, FK zu Revision und Matchteilnahme, zusätzlich `event_id`. `measured_value numeric(14,4)?`, `placement int?`. Bei `number` ist der Messwert Pflicht, die Platzierung wird abgeleitet; bei `outcome` wird ausschließlich die Platzierung gespeichert. |
| `devices` | Registriertes Erfassungsgerät: `registered_by? → profiles` nur bei Organisatoren, `label text`, `last_seen_at timestamptz?`. UUID je Installation; kein Hardware-Fingerprinting. Wird auch beim Codebeitritt ohne Profil angelegt. Geräte-ID dient der Zuordnung, nicht als Berechtigungsnachweis. |
| `event_device_states` | PK `(event_id,device_id)`, FKs zu Event und Gerät. `downloaded_plan_version int`, `last_reported_sequence bigint` Default 0, `final_sequence bigint?`, `reconciled_at timestamptz?`. Geräte werden vorab als erwartete Quellen registriert. Ein fehlendes Gerät wird beim Abschluss sichtbar. |
| `result_submissions` | Dauerhaftes Server-Eingangsjournal, PK `request_id uuid` bereits offline erzeugt. `event_id`, `match_id`, `device_id`, `submitted_by? → profiles` bei Organisatoren, `device_access_id? → device_event_access`, `checkin_id? → station_checkins`, `local_sequence bigint`, `base_result_version int`, `plan_version int`, `payload jsonb`, `payload_hash text`, `status` (`accepted/conflict/needs_review/resolved`), `captured_at` vom Gerät, `received_at` vom Server. UNIQUE `(event_id,device_id,local_sequence)`. Stationsabgaben verlangen Gerätezugang und passenden Check-in; Organisatorabgaben verlangen aktive Mitgliedschaft. Mindestens einer dieser Berechtigungswege muss vorliegen. Payload einschließlich ausgewählter Namensanzeige ist unveränderlich; Fachstatus ist serververwaltet. Optional `resolution_request_id? → result_submissions` dokumentiert die Konfliktauflösung. |

`result_values` muss zusätzlich garantieren, dass Revision und Teilnahme dasselbe Match betreffen. Das geschieht durch einen Constraint-Trigger oder einen zusätzlichen, zusammengesetzt abgesicherten `match_id`; ein einfacher Event-FK reicht dafür nicht.

## 4. Beziehungen und Modellierungsentscheidungen

**Veranstaltung und Vorlagen:** Ein Event hat jeweils 1:n Teams, Stationen, Spiele und Blöcke. Vorlage zu Veranstaltungsspiel ist 1:n, auf Spielseite optional. Die Kopie verhindert, dass geänderte Regeln aus 2027 rückwirkend Ergebnisse von 2026 verändern. Beim Kopieren eines Sporttags entstehen neue IDs; Ergebnisse und Berechtigungen werden nicht automatisch übernommen.

**Station, Block und Spiel:** Stationen und Blöcke bilden über `station_setups` eine n:m-Beziehung. Jede Belegung hat genau ein Veranstaltungsspiel. Dasselbe Spiel darf an mehreren Stationen gleichzeitig laufen. Ein Spielwechsel innerhalb eines Blocks erfordert im Kernmodell einen neuen Block.

**Runden und Matches:** Ein Block besitzt mehrere Runden; eine Spielrunde enthält null bis viele parallele Matches. Jedes Match nutzt genau eine Stationsbelegung aus demselben Block. Station und Spiel werden daraus abgeleitet und nicht als unabhängig änderbare Matchfelder gespeichert.

**Matches und Teams:** n:m über `match_participants`. Die Spielkonfiguration legt die zulässige Teilnehmerzahl fest. Ein Team darf in einer Runde höchstens ein nicht abgesagtes Match haben; es muss keines haben. Entwürfe dürfen noch unvollständige Paarungen besitzen, gestartete Matches nicht.

**Benutzer und Betreuung:** Organisatoren besitzen persönliche Profile und n:m-Mitgliedschaften in Events. Stationsmanager besitzen keine persönlichen Profile; ein Gerät erhält nach Codebeitritt einen Eventzugang. Die geplanten Personen stehen als `event_staff` n:m zu Stationsbelegungen. Tatsächliche Check-ins verbinden Gerätezugang und Belegung, ihre ausgewählten Personen stehen in `checkin_staff`. Planung, tatsächliche Anwesenheit und technischer Zugang werden somit unabhängig modelliert. Ein Stationswechsel braucht keinen neuen Account und keine zusätzliche Freigabe.

**Ergebnisse:** Match zu Ergebnisrevision ist 1:n. Der aktuelle gültige Stand ist genau die Revision mit `version = matches.current_result_version`, bei Version 0 gibt es noch kein Ergebnis. Jede gültige Revision enthält genau einen Ergebniswert für jede Matchteilnahme. Frühere Revisionen bleiben erhalten. Damit ist eine Ergebnishistorie vorhanden, ohne bereits sämtliche Planungsänderungen in ein allgemeines Audit-System zu verlagern.

**Offline-Abgaben:** Ein Match kann mehrere eingegangene Abgaben besitzen. Jede Abgabe erzeugt höchstens eine gültige Revision. Widersprüchliche Abgaben werden ebenfalls gespeichert, verändern aber zunächst nicht die Tabelle. Die serverseitige Speicherung einer Abgabe und deren fachliche Annahme sind zwei getrennte Zustände. Der lokale Speicher und dessen Warteschlange sind in Abschnitt 11 separat modelliert.

## 5. Ergebnis und Wertung

### Eingabeebene

Für den Kern genügen zwei Eingabeformen:

- `outcome`: Platzierungen, bei zwei Teams Sieg/Niederlage als 1/2 und Unentschieden als 1/1. Für mehrere Teams werden vollständige Platzierungen gespeichert.
- `number`: Ein Messwert je Team in einer festen Einheit, etwa Treffer, Sekunden oder Meter. `higher` oder `lower` entscheidet, welcher Wert besser ist. Zeiten werden beispielsweise stets in Sekunden gespeichert, unabhängig von der Anzeige.

Bei numerischen Gleichständen entstehen gemeinsame Plätze im Wettbewerbsrang: 1, 1, 3. `allow_ties=false` verhindert den Abschluss eines Gleichstands; zunächst muss nach einer festgelegten Spielregel ein eindeutiges Ergebnis vorliegen. Mehrere Versuche, Sätze oder unterschiedliche Messgrößen pro Spiel sind eine spätere Erweiterung, kein unstrukturiertes JSON-Ergebnis.

### Übersetzung in Tabellenpunkte

Bestätigter Standard: Zum Beispiel ergibt ein Sieg mit 3:2 bei Fähnchen klauen dieselben Tabellenpunkte wie ein Sieg mit 30:20 bei einem anderen Spiel. Spielpunkte bleiben für Anzeige und Nachvollziehbarkeit erhalten, beeinflussen aber nicht die Gewichtung des Sieges. Auch die rohe Punktedifferenz zwischen verschiedenen Spielen ist kein Standard-Tiebreaker.

| Modus | Beispielkonfiguration | Berechnung |
|---|---|---|
| `win_draw_loss` | `{"win":3,"draw":1,"loss":0}` | Nur zwei Teams; Ergebnisvergleich ergibt 3/0 oder 1/1. |
| `raw_value` | `{"factor":1}` | Optionale spätere Sonderregel, nicht Bestandteil der Standard-Gesamttabelle. Keine Vermischung verschiedener Spielpunkteskalen. |
| `placement` | `{"points_by_place":{"1":3,"2":2,"3":1},"unlisted_points":0,"tie_policy":"same_place"}` | Einstellbare Punkte je Platz, übrige Plätze explizit 0. Beispiel für ein großes Match, keine feste Vorgabe. |

Im Backoffice werden für den Sporttag die Punkte für Sieg, Unentschieden und Niederlage eingestellt. Für das Kamelspiel wird eine eigene Spielwertung gewählt: beispielsweise nur Platz 1 mit 3 Punkten, alle anderen 0; alternativ Top 3 mit etwa 3/2/1 Punkten, alle anderen 0. Die Werte für Platz 2 und 3 sind frei einstellbar; die genannten Zahlen sind Beispiele. Eine begrenzte Platzliste plus `unlisted_points` macht die Behandlung aller übrigen Teams ausdrücklich.

Ein „nur Gewinner“-Spiel benötigt nicht die vollständige Rangfolge der Verlierer: Platz 1 wird für den Gewinner, ein gemeinsamer Platz 2 für die übrigen Teams gespeichert. Bei Top-3-Punkten können alle Teams außerhalb der Top 3 einen gemeinsamen Platz 4 erhalten. Das gilt für erfasste Platzierungen; numerische Ergebnisse erzeugen weiterhin die vollständige Rangfolge. Die Gruppierung nicht weiter gewerteter Teams ist kein entscheidungspflichtiger Gleichstand: `allow_ties=false` betrifft bei solchen Eingaben die ausdrücklich ausgespielten Plätze. Bei Platzgleichheit ist die vorgeschlagene Regel „gleicher Platz, gleiche Punkte“ im Setup sichtbar. Wenn exakt drei Teams Punkte erhalten sollen, muss das Spiel eindeutige Plätze liefern oder eine Stichentscheidung festlegen.

Auswahl bei Veröffentlichung: Spielregel überschreibt Event-Default. Das Match speichert anschließend den aufgelösten Regel-FK. Individuelle Matchregeln sind zunächst keine Backoffice-Funktion. Das Feld fixiert die tatsächlich verwendete Regel.

Regeln und ergebnisrelevante Spielattribute bleiben auch nach Veröffentlichung durch Organisatoren änderbar (bestätigt). Änderungen an einem veröffentlichten oder laufenden Event erhöhen automatisch `events.plan_version`, damit Geräte das Offline-Paket neu laden. Eine Änderung bereits gewerteter Regeln wirkt sich auf die Tabelle aus und bleibt über die Revisionshistorie nachvollziehbar; ein eigener Neuwertungsprozess ist nicht vorgesehen.

Tabellenpunkte werden berechnet und nicht zusätzlich je Team gespeichert. Nur abgeschlossene, wertungsrelevante Matches mit gültiger aktueller Revision zählen. Abgesagte und offene Matches zählen nicht. Falls ein Mehrteamspiel vorgesehen ist, fließt es mit seiner im Setup festgelegten Platzierungsregel in dieselbe Tabelle ein. Ohne ein solches Spiel funktioniert die Tabelle unverändert. Es gibt keinen davon unabhängigen Final-Gesamtsieger. Eine höhere Gewichtung wird durch die Platzierungspunkte selbst eingestellt, ohne versteckten zusätzlichen Multiplikator.

Default für die Gesamtwertung: Summe der Tabellenpunkte absteigend; bei Gleichstand geteilter Rang. Siege/Unentschieden/Niederlagen werden nur für Zweiermatches ausgewiesen. Rohpunkte und Gegenpunkte werden pro Spiel/Einheit ausgewertet; Meter, Sekunden und Treffer dürfen nicht zu einer scheinbar sinnvollen Gesamtsumme vermischt werden.

### Speichern und korrigieren

Zuerst speichert eine lokale Transaktion Ergebnisabgabe und Übertragungsauftrag gemeinsam. Erst nach erfolgreichem Commit zeigt die App „Auf diesem Gerät gespeichert“. Dafür braucht sie weder eine Serververbindung noch eine erfolgreiche Token-Erneuerung. Die Details der Wiederherstellung und Synchronisation stehen in Abschnitt 11.

Bei Synchronisation prüft der Server Identität und Eventzugriff und persistiert die Abgabe im Eingangsjournal. Unter einer Matchsperre prüft er Planbezug, Berechtigung, Matchstatus und erwartete Ergebnisversion. Eine passende Abgabe erzeugt atomar Revision plus alle Teamwerte, aktuelle Version und abgeschlossenen Matchstatus. Eine widersprüchliche oder fachlich gesperrte Abgabe bleibt als `conflict/needs_review` erhalten. Wiederholte Requests mit derselben `request_id` liefern den bestehenden Empfangsbeleg; Wiederverwendung mit abweichendem Inhalt wird abgelehnt.

Zwei gleichzeitige Bearbeiter überschreiben sich somit nicht stillschweigend. Stationsmanager dürfen nach selbst gewähltem Check-in Ergebnisse der entsprechenden Belegung speichern und Korrekturvorschläge offline sichern. Default: Zentrale Korrekturen bestätigt ein Organisator mit Begründung. Lokal gespeicherte, noch unbestätigte Ergebnisse sind sichtbar als ausstehend gekennzeichnet. Die zentrale Tabelle zählt nur serverseitig angenommene Revisionen. Für konfliktfreie Erstabgaben gibt es keine zusätzliche Freigabestufe.

## 6. Zeitplan, Pausen und optionale Mehrteamspiele

Planzeiten werden als `timestamptz` gespeichert und in `events.timezone` dargestellt. `event_date` bezeichnet den Veranstaltungstag. Intervalle sind halboffen `[Start, Ende)`, direkt anschließende Slots sind erlaubt.

Allgemeine Pausen zwischen Blöcken sind `blocks.kind=break`. Pausen innerhalb eines Blocks sind `rounds.kind=break`. Damit ist kein zusätzliches generisches Kalendersystem nötig. Eine Lücke ohne Match bedeutet für das betreffende Team Freizeit, kein eigenes Pausenobjekt.

Ein Teamspielplan im Backoffice entsteht aus Team → Matchteilnahme → Match → Runde sowie Stationsbelegung → Station/Spiel. Globale Pausen werden ergänzt. Die Stationsansicht filtert dieselben Matches nach Belegung; laufende Matches werden über Status erkannt, geplante über Runde und Uhrzeit. Es gibt keine zweite Spielplantabelle und keine öffentliche Teilnehmer-App im aktuellen Umfang.

Ein optionales Mehrteamspiel verwendet ein normales Match in einer Spielrunde, eine gemeinsame Station, etwa „große Wiese“, und eine Teilnahme pro Team. Es benötigt weder einen Sonderblock noch einen Platz am Ende des Tages. Bei sechs Teams entstehen sechs `match_participants` und sechs Werte je Ergebnisrevision. Eine neue Matchtabelle ist dafür nicht nötig. Es gibt keine Pflicht, ein solches Match anzulegen.

Die zugehörige Spielkonfiguration erlaubt die tatsächliche Teamzahl. Ihre Platzierungsregel überschreibt den Zweiermatch-Default. Bestätigte Optionen sind Gewinnerpunkte oder Punkte für die Top 3, jeweils im Backoffice konfigurierbar. Beides verwendet den Modus `placement`. Rohpunkte dieses Spiels werden nicht automatisch zur Tabelle addiert. Ohne vollständig konfigurierte Mehrteam-Wertung darf das Match nicht als wertungsrelevant veröffentlicht werden.

Der Gesamtsieger wird über die Tabelle ermittelt. Eine KO-Struktur oder automatische Finalqualifikation gehört damit derzeit nicht zum Kern. Der historische Typ `final` kann bei Bedarf als Zeitblocklabel bleiben, hat aber keine eigene Siegerlogik.

## 7. Integrität und Prüfungen

### Direkt durch Schlüssel und CHECKs

- Alle Veranstaltungsreferenzen bleiben im selben Event: Kindtabellen referenzieren `(event_id,id)` des Elternobjekts; Eltern erhalten den entsprechenden UNIQUE-Schlüssel. Dies gilt auch für Default- und Spielwertungsregeln, aktive Karte und Gerätezugänge.
- Zeiten: Start < Ende; Positionen und Slots > 0; `1 <= min_teams <= max_teams`; Dauer und Teamgröße, falls vorhanden, > 0.
- Ein Spiel je Station/Block, eindeutige Mitgliedschaften und Matchteilnahmen gemäß Datenkatalog.
- Höchstens ein nicht abgesagtes Match je `(round_id,station_setup_id)` durch partiellen Unique-Index.
- Keine NaN-/Infinity-Messwerte; Zahlenformat, Einheit und erlaubter Wertebereich werden passend zur Spielkonfiguration geprüft. Null bedeutet fehlend und niemals automatisch null Punkte.
- Stationskoordinaten müssen gültige WGS84-Werte und innerhalb des gewählten Kartenausschnitts sein. Für die Web-Mercator-Übersicht sind Breitengrade auf deren darstellbaren Bereich begrenzt. Kartenbreite/-höhe > 0, Süd < Nord und West < Ost; ein Ausschnitt über die Datumsgrenze ist für diesen Anwendungsfall nicht erforderlich.
- Check-in, Gerätezugang, ausgewählte Personen und Match müssen zum selben Event gehören; ein referenzierter Check-in muss dieselbe Stationsbelegung wie das Match haben. Alle Querreferenzen werden zusammengesetzt oder transaktional geprüft.
- Check-ins verschiedener Geräte dürfen dieselbe Belegung nutzen. Ein Check-out erfolgt nicht durch Löschen; das Ergebnis behält seinen Erfassungskontext.

### Transaktionale Prüfungen / Constraint-Trigger

- Runde liegt innerhalb ihres Blocks; Blöcke eines Events und Runden desselben Blocks überschneiden sich nicht. Globale Pausen schließen Spielbetrieb aus.
- Runde und Stationsbelegung des Matches liegen im selben Block. Pausen enthalten keine Matches.
- Team wird nicht doppelt in einer Runde eingeplant. Eine Prüfung allein im Client oder ein ungesperrtes SELECT vor INSERT ist hierfür nicht ausreichend; Schreiboperationen werden je Event serialisiert oder mit passenden Datenbanksperren abgesichert.
- Veröffentlichung verlangt vollständige Paarungen, zulässige Teilnehmerzahlen und kompatible Wertungsregeln. Die Zweierregel `win_draw_loss` darf nicht auf ein Mehrteamspiel angewendet werden. Ein Abschlussspiel wird nicht verlangt.
- Bei Matchstart sind alle Teams bekannt. Bei Ergebnisabschluss liegt genau ein gültiger Wert pro Teilnahme vor; Platzierungen und Gleichstände passen zu Spielregeln.
- Teilnehmer, Belegung und ergebnisrelevante Konfiguration bleiben auch nach Veröffentlichung durch Organisatoren änderbar (bestätigt). Ein bereits abgeschlossenes Match wird nicht stillschweigend überschrieben; seine Neuplanung und ein Ergebnisrückzug sind eigene, protokollierte Vorgänge.
- Zeitplanänderungen prüfen betroffene Kinder erneut, nicht nur das veränderte Objekt. Nach Veranstaltungsbeginn erfolgen sie ausschließlich durch Organisatoren.
- Statusübergänge werden lokal und serverseitig geprüft: `scheduled → ready → in_progress → completed`, Abbruch vor Abschluss zu `cancelled`. Da Zwischenschritte offline stattfinden, darf eine vollständige autorisierte Ergebnisabgabe serverseitig auch `scheduled → completed` atomar durchführen. Abgesagte Matches werden nicht automatisch reaktiviert. Korrektur erzeugt eine neue Revision bei unverändert `completed`. Ein **Ergebnisrückzug** öffnet das Match wieder (`completed → scheduled`) als leere Revision mit Begründung; die Historie bleibt erhalten.

### Löschung und Aufbewahrung

Entwürfe dürfen kontrolliert gelöscht werden. Sobald Ergebnisse vorhanden sind, wird die Veranstaltung archiviert; Teams, Spiele, Matches und Regeln werden nicht kaskadierend entfernt. Verwendete Vorlagen werden archiviert oder deren optionale Herkunftsreferenz wird gelöst. Entfernte Benutzerkonten dürfen Ergebnisse nicht mitlöschen: Autor-FK wird nullable, Historie bleibt erhalten; Vorlagenbesitz muss zuvor übertragen oder die Vorlage entfernt werden. Eine konkrete Aufbewahrungsfrist ist fachlich noch festzulegen.

## 8. Supabase und Zugriffskonzept

Das Modell verwendet PostgreSQL-Standardmittel: UUID, relationale Fremdschlüssel, Constraints und Transaktionen. Persönliche Auth-Accounts sind für Organisatoren vorgesehen. Für Stationsgeräte wird technisch eine anonyme Supabase-Sitzung vorgeschlagen: ohne Registrierung, E-Mail oder Passwort im Nutzerflow. Supabase legt dafür intern einen anonymen Auth-Datensatz an; dieser ist kein persönlicher Account von Joel oder Elias. Erst das Einlösen des Veranstaltungscodes erteilt Eventrechte. [Supabase: Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)

| Daten / Aktion | Organisator des Events | Stationsgerät mit Eventcode-Zugang | Ohne Eventzugang |
|---|---|---|---|
| Teams, Ablauf, Karte, Ergebnisse | lesen und planen | für eigenes Event lesen | kein Zugriff |
| Planung und Wertungsregeln | im zulässigen Status ändern | nicht ändern | kein Zugriff |
| Station/Block und angezeigte Betreuung wählen | ja | selbst auswählen und einchecken | kein Zugriff |
| Erstes Ergebnis | speichern | gewählte Station/Block nach Check-in | kein Zugriff |
| Ergebniskorrektur und Historie | lesen und korrigieren | eigene aktuelle Ergebnisse lesen | kein Zugriff |
| Einsatzplanung, Codes und Hilfe-Konfiguration | verwalten | Plan lesen, Konfiguration nicht ändern | kein Zugriff |
| Spielvorlagen | eigene verwalten, Eventkopien nutzen | Eventkopien lesen | kein Zugriff |

RLS wird auf allen über die API erreichbaren Tabellen aktiviert. Organisatorenrechte folgen aus aktiven `event_memberships`. Stationszugriff folgt aus `device_event_access.auth_user_id = auth.uid()` mit passendem Event und ohne Widerruf. Die Rolle `authenticated` allein genügt nicht, da auch anonyme Auth-Sitzungen diese Rolle erhalten. Stationspersonen und Check-ins vergeben keine Backoffice-Rechte. Eventanlage plus erste Organisatoren-Mitgliedschaft erfolgen atomar über einen kontrollierten Servervorgang. [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

Der Codebeitritt läuft über einen begrenzten Server-Endpunkt: sechsstelligen Code serverseitig prüfen, Versuchsraten begrenzen, Event und Gültigkeit prüfen, Gerätezugang ausstellen. Für die geringe Codeentropie wird ein serverseitig geheimnisgebundener Digest verwendet; keine ungeschützte Liste mit Code-Hashes für Clients. Aktive Codes identifizieren das Event eindeutig. Im Backoffice wird ein neuer Code einmal angezeigt und kann anschließend ersetzt werden. Das Gerät speichert die erhaltene Sitzung, nicht den Veranstaltungscode als dauerhaftes Passwort. Ein rotierter Code verhindert neue Beitritte mit dem alten Code; bestehende Gerätezugänge werden separat widerrufen.

Selbstauswahl ist ausdrücklich erwünscht: Ein eingelassenes Stationsgerät wählt den eigenen Namen aus der Betreuungsliste; die zugehörigen Belegungen je Block ergeben sich aus der Einsatzplanung, ohne individuelle Freischaltung. Die Anmeldung erfolgt als Person, nicht als Station. Check-in und Check-out geschehen je Block an der Station, mit höchstens einem aktiven Check-in gleichzeitig. Namen im Verlauf sind Selbstauskunft. Technisch nachvollziehbar bleiben Gerät, Zugang, Check-in, Planstand und Abgabe; eine persönliche Identitätsprüfung wird nicht behauptet.

Ergebnisrevisionen und Wertzeilen sind für Clients nicht direkt schreibbar. Ein kontrollierter RPC bildet die Ergebnistransaktion einschließlich noch nicht synchronisiertem Check-in ab. Falls dafür erhöhte Datenbankrechte erforderlich sind, braucht die Funktion explizite Prüfungen des Gerätezugangs oder der Organisatorenmitgliedschaft, einen festen `search_path` und eng begrenzte EXECUTE-Rechte. Service-Role-Schlüssel bleiben serverseitig.

Für Spielplan- und Ranglistenviews ist `security_invoker=true` auf unterstützten PostgreSQL-Versionen vorzusehen. Karten und Medien in Supabase Storage werden über den Eventzugang freigegeben und als vollständige lokale Dateien heruntergeladen; eine später ablaufende Download-URL darf die Offline-Karte nicht unbrauchbar machen. Öffentliche Endpunkte oder ein `public_enabled`-Feld sind im aktuellen Entwurf nicht erforderlich. [Supabase: Views und RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#views-and-rls)

Realtime kann Änderungen der Matches abonnieren. Nach einer neuen Ergebnisversion lädt der Client aktuelle Ergebnisse und Rangliste erneut. Berechnete Views werden nicht wie Tabellen als eigene Änderungsquelle behandelt. Nach Verbindungsabbrüchen erfolgt ein vollständiger Neuabruf; Realtime ersetzt keine Offline-Synchronisation. [Supabase: Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

Wichtige Indexzugriffe: Mitgliedschaft `(user_id,event_id)`, Gerätezugang `(auth_user_id,event_id)`, Betreuung `(staff_id,station_setup_id)`, Check-in `(device_access_id,station_setup_id)`, Teamteilnahme `(team_id,match_id)`, Matches `(event_id,round_id)` und `(station_setup_id,round_id)`, Revisionen `(match_id,version)`. Vorhandene Unique-Indizes werden genutzt, nicht doppelt angelegt. Für die erwartete Sporttagsgröße genügen dynamische Aggregationen; materialisierte Ranglisten sind zunächst nicht nötig.

### 8.1 Backoffice-RPCs (Migration `20260921131505_backoffice_rpcs_full`)

Ein Trigger auf `auth.users` (nicht für anonyme Sitzungen) legt bei der Registrierung automatisch eine `profiles`-Zeile an; `create_event` legt sie zusätzlich clientseitig sicherheitshalber nach und ergänzt beim Anlegen eine Standard-Wertungsregel `win_draw_loss` (3/1/0), die sofort als `default_scoring_rule_id` gesetzt wird.

Die Statusmaschine der Veranstaltung (`draft → published → running → finished → archived`, `draft → archived`, `published → draft` nur ohne vorhandene `result_submissions`) wird per Trigger auf `events.status` erzwungen. `set_event_status` deckt alle Übergänge außer der Veröffentlichung ab; `publish_event` prüft zusätzlich `check_event_readiness` (Fehler blockieren, Warnungen nicht), löst je Match die effektive Wertungsregel auf (`match.scoring_rule_id ?? event_game.scoring_rule_id ?? event.default_scoring_rule_id`) und erhöht `plan_version`. `check_event_readiness(event_id)` liefert eine JSON-Liste aus `{code, severity, message}` und ist auch für die Übersichtsseite nutzbar.

Planungsintegrität wird durch Constraint-Trigger statt nur durch Client-Prüfung sichergestellt: Blöcke und Runden dürfen sich nicht überschneiden, Runden müssen innerhalb ihres Blocks liegen, ein Match muss Runde und Stationsbelegung im selben Block referenzieren und darf nicht in einer Pausenrunde liegen, ein Team darf nicht doppelt in derselben Runde eingeplant werden (`pg_advisory_xact_lock` je Runde beziehungsweise Block verhindert Race Conditions bei gleichzeitigen Schreibzugriffen). Ergebnisrelevante Felder (`scoring_rules.mode/config`, `event_games.measurement_type/comparison_direction/min_teams/max_teams/allow_ties/scoring_rule_id`, `match_participants`) sind auch nach Veröffentlichung änderbar; statt einer Sperre erhöhen strukturelle Änderungen automatisch `events.plan_version` (Migration `20260922110000_editable_published_events`).

Der Veranstaltungscode wird über `rotate_access_code(event_id, valid_until?)` erzeugt: sechsstellig mit führenden Nullen, Digest per `hmac(code, pepper, 'sha256')` mit einem in `vault.secrets` gehaltenen Geheimnis (`event_access_code_pepper`), Klartext wird ausschließlich als Rückgabewert einmalig herausgegeben und nirgends gespeichert. `revoke_access_code` widerruft den aktiven Code. `redeem_access_code(code, device_id, device_label)` prüft den Digest, begrenzt Versuche auf zehn je zehn Minuten und Nutzer (`private.access_code_attempts`) und stellt `device_event_access` aus; er ist jetzt auch an den Stationsbeitritt im Client angebunden (`lib/station/identity.ts`). `revoke_device_access` widerruft einzelne Gerätezugänge unabhängig vom Code.

Weitere Organisatoren werden über `add_event_organizer(event_id, email)` anhand einer bestehenden, nicht-anonymen `auth.users`-E-Mail hinzugefügt; `list_event_organizers` liefert Name und E-Mail für die Einstellungen. Ein Trigger verhindert das Entfernen des letzten aktiven Organisators. `delete_draft_event(event_id)` löscht einen Entwurf ohne Ergebnisabgaben vollständig inklusive aller Kinder in FK-Reihenfolge; veröffentlichte Veranstaltungen werden ausschließlich archiviert.

### 8.2 Station-Laufzeit-RPCs (Migration `20260921200000_station_runtime`, Fix `20260921200100`)

`get_station_package(event_id)` liefert das vollständige Offline-Paket als ein konsistentes JSON-Objekt (`security invoker`, ein einzelnes SELECT): Event, Teams, Stationen, Wertungsregeln, Spiele, Blöcke, Runden, Stationsbelegungen, Betreuung (Stations- und Spielzuordnung), Matches mit Teilnahmen und die aktuellen Ergebniswerte. `sync_station_checkin(id, event_id, station_setup_id, device_id, checked_in_at, checked_out_at?, staff_ids[])` ist ein idempotenter Upsert von `station_checkins`/`checkin_staff`, der jeden anderen aktiven Check-in desselben Gerätezugangs beendet, damit höchstens einer gleichzeitig aktiv bleibt.

`submit_result` wurde erweitert: Die Autorisierung prüft den *aktuellen* aktiven Gerätezugang des Geräts (nicht zwingend denselben `device_access_id` wie beim ursprünglichen Check-in), damit ein erneuter Codebeitritt nach Sitzungsverlust bestehende Check-ins weiterverwenden kann. Eine Abgabe mit `base_result_version > 0` (eine Korrektur eines bereits vorhandenen Ergebnisses) wird jetzt **immer** als `needs_review` gespeichert und erzeugt keine Revision, unabhängig von der tatsächlichen aktuellen Serverversion — Korrekturen benötigen stets eine Organisatorenbestätigung (Abschnitt 5).

`report_device_state(event_id, device_id, plan_version, last_sequence?)` ist ein einfacher Heartbeat unabhängig von einer Ergebnisabgabe. `submit_device_manifest(event_id, device_id, final_sequence, entries[])` prüft Lückenlosigkeit (`generate_series` gegen die gemeldeten `local_sequence`-Werte) und Inhaltsübereinstimmung (`payload_hash`) und setzt bei vollständiger Übereinstimmung `event_device_states.final_sequence`/`reconciled_at`. `event_device_states.expected` (Default `true`) markiert, ob ein Gerät für den Abschlussabgleich erwartet wird; `set_device_expected` (nur Organisatoren) ändert das. `check_event_reconciliation(event_id)` liefert eine Liste offener Punkte im selben `{code,severity,message}`-Format wie `check_event_readiness`: erwartete Geräte ohne bestätigtes Manifest, offene Konflikte/Korrekturvorschläge, Matches ohne Ergebnis. `confirm_event_reconciliation` setzt `events.reconciled_at`, sofern keine Fehler offen sind; eine neue Ergebnisabgabe danach hebt die Bestätigung automatisch wieder auf (Trigger `result_submissions_reset_reconciliation`). `device_sync_overview(event_id)` (nur Organisatoren) liefert die Zusammenfassung je Gerät für das Backoffice-Modul Geräte & Synchronisierung. `station_checkins`, `event_device_states` und `device_event_access` liegen zusätzlich in der Realtime-Publication.

Beim Testen dieser Migration wurde ein vorbestehender Fehler in `redeem_access_code` gefunden und in derselben Migrationsfolge behoben: `devices.registered_by` referenziert `profiles(id)`, die Funktion setzte das Feld aber bedingungslos auf `auth.uid()` — für eine anonyme Stationssitzung ohne Profil verletzte das immer den Fremdschlüssel. Der Fix setzt `registered_by` nur, wenn tatsächlich ein Profil existiert (Organisatoren-Codeeinlösung bleibt möglich, anonyme Geräte bleiben `NULL`).

### 8.3 Ergebnis-Korrektur und Tabelle (Migration `20260922080158_results_module`)

`result_submissions.device_id`/`local_sequence` sind jetzt nullable, damit neben dem Gerätepfad auch ein Organisatorpfad möglich ist; die bestehende CHECK-Bedingung `submitted_by ≠ device_access_id` (genau eines von beidem) blieb unverändert und trennt beide Pfade weiterhin eindeutig.

`organizer_record_result(event_id, match_id, base_result_version, payload, reason?, resolves[]?)` ist der Organisatoren-Gegenpart zu `submit_result`: optimistische Sperre über `base_result_version` (Fehler `result_version_changed` bei Abweichung), Pflichtbegründung (`reason_required`), sobald `base_result_version > 0` ist oder Abgaben mitaufgelöst werden, sowie dieselbe Teilnehmer- und (neu, auch für `submit_result` fällig) Unentschieden-Prüfung (`ties_not_allowed`) bei `allow_ties = false`. Die Funktion schreibt Abgabe, Revision und Werte in einem Schritt, setzt `matches.current_result_version`/`status = 'completed'` und markiert die in `resolves` genannten Abgaben als `resolved` mit `resolution_request_id` — der in Abschnitt 11.4 vorgesehene Verweis auf die aufgelösten Abgaben.

`dismiss_submissions(event_id, request_ids[], reason)` klärt eine Abgabe ohne neue Revision (identisch mit dem aktuellen Stand, oder schlicht verworfen), ebenfalls mit Pflichtbegründung, die am betroffenen Match protokolliert wird (gleiches Muster wie ein manueller Statuswechsel im Live-Modul). Beide Funktionen sind `security definer`, nur für Organisatoren (`private.is_event_organizer`) und lösen über den bestehenden Trigger `result_submissions_reset_reconciliation` bei Bedarf die Abschlussbestätigung.

Für die Tabelle wurde die bisher in `standings` eingebettete Punktelogik in eine eigene View `result_points` ausgelagert (eine Zeile je gezähltem Match und Team: `points`, bei `win_draw_loss` zusätzlich `outcome` win/draw/loss). `standings` liest jetzt aus `result_points` und ergänzt `rank` (`rank() over (order by table_points desc)`, also geteilte Ränge bei Gleichstand), `matches_played` sowie `wins`/`draws`/`losses`. Endgültig ist die Tabelle, sobald `events.reconciled_at` gesetzt ist (Abschnitt 11.5); bis dahin gilt sie als vorläufig.

### 8.4 Live-Zwischenstand (Migration `20260921210000_match_live_state`)

`sync_match_live(event_id, match_id, device_id, device_access_id, checkin_id, values, started, updated_at)` ist der leichte Gegenpart zu `submit_result`: Er autorisiert denselben Gerätezugang und prüft denselben passenden Check-in, schreibt aber ausschließlich `match_live_states`. Bei `started = true` setzt er `matches.status` von `scheduled/ready` auf `in_progress` mit `actual_started_at` (ein abgeschlossenes oder abgesagtes Match wird nie reaktiviert). Der Upsert ist idempotent und folgt Last-Write-Wins über den vom Gerät gesendeten Zeitstempel; ein älterer Stand überschreibt keinen neueren. So teilen mehrere Geräte derselben Station einen Stand, ohne einen `result_submissions`-Konflikt oder Korrekturvorschlag auszulösen. Die Tabelle liegt in der Realtime-Publication.

### 8.5 Laufzettel der Gruppen (Migration `20260922100000_team_station_visits`)

`sync_team_visit(event_id, participant_id, device_id, device_access_id, checkin_id, arrived_at, released_at, updated_at)` hält fest, wann eine Gruppe an einer Station eingetroffen ist und wann sie weitergeschickt wurde. Autorisierung und Check-in-Prüfung sind dieselben wie bei `sync_match_live`; geschrieben wird ausschließlich `team_station_visits` (ein Eintrag je `match_participants.id`). Der Upsert ist idempotent und folgt Last-Write-Wins über den vom Gerät gesendeten Zeitstempel, damit mehrere Geräte derselben Station ohne Konflikt auf denselben Stand kommen. `matches` und Ergebnisse bleiben unberührt: Der Laufzettel dokumentiert den Ablauf, nicht die Wertung. Die Tabelle liegt in der Realtime-Publication; `get_station_package` liefert sie als `team_visits` mit aus, zusammen mit `matches.actual_started_at`/`actual_ended_at`, damit das Stationsgerät die Zeitleiste auch ohne Internet zeichnen kann.

### 8.6 Nachträgliche Änderungen an veröffentlichten Events (Migration `20260922110000_editable_published_events`)

Die frühere Sperre „nur Entwürfe sind bearbeitbar“ ist aufgehoben: Teams, Spiele & Wertung, Zeitplan und Event-Einstellungen bleiben auch nach der Veröffentlichung änderbar. `private.guard_locked_after_publish` ist nur noch ein No-op; strukturelle Änderungen an einem veröffentlichten oder laufenden Event erhöhen stattdessen automatisch `events.plan_version` (`private.bump_plan_version` auf Teams, Stationen, Wertungsregeln, Spielen, Blöcken, Runden, Stationsbelegungen, Betreuung und Zuordnungen sowie auf `matches` bei Anlegen/Löschen; ein `BEFORE`-Trigger auf `events` für Dauer-, Startzeit-, Zuordnungs- und Geländefelder). Dadurch laden Geräte das Offline-Paket beim nächsten Sync neu. Laufzeit- und Ergebnisänderungen an `matches` (Status, `current_result_version`, Live-Start) lösen bewusst **keine** neue Planversion aus, damit laufende Abgaben nicht als Konflikt gelten.

### 8.7 Ergebnis zurückziehen (Migration `20260922120000_withdraw_result`)

`withdraw_result(event_id, match_id, reason)` löscht ein Ergebnis weich: Es schreibt eine leere Revision (ohne `result_values`) mit Pflichtbegründung, setzt `matches.current_result_version` auf die neue Version und öffnet das Match wieder (`status = 'scheduled'`, `actual_ended_at = null`). Das Match zählt damit nicht mehr in der Tabelle, bleibt aber über Revisions- und Abgabehistorie vollständig nachvollziehbar. Nur für Organisatoren. Zusätzlich ist eine erstmalige **manuelle Ergebniseingabe** ohne Begründung möglich; eine Korrektur eines bestehenden Ergebnisses verlangt weiterhin eine Begründung.

## 9. Beispiel zur fachlichen Kontrolle

Sporttag 2026 hat sechs Teams und drei Stationen. Block 1 enthält drei Spielrunden. Station 1 ist in diesem Block mit Brennball belegt, im zweiten Block mit einem anderen Spiel.

Runde 1 hat an Station 1 das Match Team 1 gegen Team 2, an Station 2 Team 3 gegen Team 4 und an Station 3 Team 5 gegen Team 6. Brennball verwendet numerische Scores mit `higher` und die 3/1/0-Regel. Version 1 enthält 18 und 12; die Tabelle ergibt 3 Punkte für Team 1 und 0 für Team 2. Eine Korrektur auf 18 und 18 erzeugt Version 2: Beide erhalten nun 1 Punkt. Version 1 bleibt nachvollziehbar, zählt aber nicht zusätzlich.

Nach Block 1 folgt ein Pausenblock. Am Ende kann das Kamelspiel mit allen sechs Teams stattfinden. Seine sechs Ergebnisse werden zusammen gespeichert. Bei beispielhaft konfigurierten 3/2/1 Platzierungspunkten erhalten die ersten drei Teams diese Tabellenpunkte, die anderen 0. Diese werden zu den Tabellenpunkten aus den bisherigen Matches addiert.

Vor einer Implementierungsfreigabe sind insbesondere folgende Datenbanktests erforderlich: Event-fremde FKs ablehnen; Doppelbelegung und Teamkonflikte auch bei parallelen Requests verhindern; Spielwechsel zwischen Blöcken zulassen; Ergebnisretry idempotent behandeln; konkurrierende Korrektur zurückweisen; Rangliste nach Revision korrekt berechnen; unerlaubte RLS-Zugriffe verhindern. Dies sind geplante Abnahmetests, noch keine ausgeführten Implementierungstests.

## 10. Offene Entscheidungen und empfohlene Defaults

| Frage | Vorgeschlagener Default / Konsequenz |
|---|---|
| Einzelne Teilnehmer speichern? | Nein; nur Team und optionale Größe. Personen und Teammitgliedschaften erst bei konkretem Bedarf. |
| Teams während des Tags verändern? | Identität und Zusammensetzung bleiben fest; reine Anzeigenamen darf der Organisator korrigieren. |
| Einzelteam- oder Mehrteamspiele? | Optionale Mehrteamspiele bestätigt, auch mit allen Teams; keine Pflicht zum Abschlussspiel. Reguläre Matches typischerweise zwei Teams. |
| Spiele wiederholen oder parallel betreiben? | Beides erlaubt. Jede wertungsrelevante Wiederholung zählt; Anzahl und Fairness werden bei Planung geprüft. |
| Spielleiterwechsel? | Pro Block, mehrere Personen möglich. Wechsel innerhalb einer Runde ist noch nicht modelliert. |
| Historie/Audit? | Ergebnisrevisionen einschließlich Autor, Zeitpunkt und Korrekturgrund; vollständiges Planungs-Audit später. |
| Accounts für Stationsmanager? | Bestätigt: keine persönlichen Accounts, gemeinsamer Veranstaltungscode und technische Gerätesitzung. |
| Öffentliche Pläne und Ergebnisse? | Aus dem App-Umfang herausgenommen. Die App dient Stationsmanagement und Backoffice. |
| Backoffice-Zugang? | Bestätigt separat geschützt über Organisatoren-Accounts. |
| Geplante Personen und Check-in? | Mehrere Personen pro Station/Block; direkte Auswahl und manueller Check-in ohne persönliche Anmeldung. |
| Stationskarte? | Feste Geo-Koordinaten je Station; Satellitenübersicht mit Pins vollständig offline vorhalten. |
| Hilfe-Funktion? | Große Aktionen „Assistenz“ und „Medizinisch“, die einen nativen Anruf auf die konfigurierten Rufnummern starten. |
| Live-Rangliste? | Ja, sobald Erfassungsgeräte synchronisieren. Letzter Aktualisierungszeitpunkt und Vollständigkeit bleiben sichtbar. |
| Mehrere Wertungskategorien/Gruppen? | Eine Gesamtwertung; Kategorien, Gruppenphasen und getrennte Tabellen erst bei bestätigtem Bedarf. |
| Finalpaarungen automatisch? | Aktuell kein Bedarf; optionale Mehrteamspiele werden wie andere Matches geplant. |
| Wer ist Gesamtsieger? | Bestätigt: die Tabelle entscheidet, mit oder ohne Mehrteamspiel. Falls vorgesehen, sind dessen Gewinner-/Top-3-Punkte im Setup einstellbar. |
| Automatischer Spielplan? | Zunächst manuell. Ein späterer Generator erzeugt dieselben Matches und Teilnehmer. |
| Ergebnisbestätigung? | Lokale Sicherung sofort; zentrale Wertung nach Serverannahme. Konflikte und Korrekturen durch Organisator. |
| Offline? | Verpflichtender Kern; vollständiger Betrieb nach Vorbereitung ohne Netz, späterer Abgleich aller Geräte. Siehe Abschnitt 11. |
| Konkrete Tabellenpunkte? | Bestätigt: im Backoffice einstellbar, 3/1/0 lediglich Vorbelegung. Optionale Mehrteamspiele mit eigener Platzierungstabelle. |
| Gleichstand in Gesamtwertung? | Geteilter Rang. Keine zufällige Entscheidung oder Vermischung inkompatibler Rohwerte. |

Die Punktevergabe wird pro Veranstaltung im Setup entschieden, nicht im Programm festgeschrieben. Noch als Vorschlag gelten die Gleichstandsbehandlung, ausschließlich durch Organisatoren bestätigte Korrekturen und die bevorzugte Nutzung nativer Apps für die zuverlässige Offline-Erfassung.

## 11. Offline-Datenkonzept und Ergebnissicherung

### 11.1 Verbindlicher Ablauf und Grenzen

Vor der Abfahrt werden App, einmaliger Codebeitritt, Gerätezugang und vollständiges Veranstaltungspaket eingerichtet. Das Paket enthält Plan, Teams, Stationen, Betreuungsliste, Spielregeln, Wertung, Werkzeugkonfiguration und das vollständige Satellitenbild. Ein Prüfschritt bestätigt, dass dieses Gerät den Sporttag vollständig offline öffnen kann. Die konkrete Station und die anwesenden Namen können anschließend vor Ort offline gewählt werden. Auf einem unvorbereiteten Gerät kann ein sechsstelliger Code allein ohne Verbindung weder den Server prüfen noch die Veranstaltung herunterladen. Eine lokale Paketübergabe samt separat vorbereitetem Gerätezugang wäre ein zusätzlicher Bereitstellungsweg, nicht durch die Codeeingabe automatisch gelöst.

Danach funktionieren Spielplan, Regeln, stationsbezogene Werkzeuge, Start/Abschluss von Matches, Ergebniseingabe, Korrekturvorschläge und lokal verfügbare Auswertung ohne Netz. Der Startbildschirm darf diese Funktionen weder hinter einer Online-Abfrage noch hinter einer frischen Token-Erneuerung sperren. Die vorbereitete lokale Identität erlaubt die Offline-Erfassung; sie ersetzt keine serverseitige Autorisierung beim späteren Upload.

Die lokal bestätigte Speicherung muss einen App-Absturz, erzwungenes Beenden, Geräteneustart und tagelange Netzlosigkeit überstehen. Ein späterer App-Start setzt die Übertragung fort. Ein verlorenes/defektes Gerät, gelöschte App-Daten oder eine Deinstallation vor jeder weiteren Kopie können dagegen die einzige Datenkopie vernichten. Dafür ist eine zweite Kopie auf einem anderen Gerät erforderlich; ein absoluter Schutz durch eine einzelne lokale Datenbank wäre ein falsches Versprechen.

Die zentrale Rangliste im Backoffice enthält nur bereits übertragene Daten. Ohne Netz zwischen Geräten kann kein Handy die neuen Ergebnisse anderer Stationen kennen. Die Anzeige nennt den Datenstand und „vorläufig“, solange der Abschlussabgleich fehlt. Die eigene Offline-Auswertung verwendet heruntergeladene Ergebnisse plus lokale Abgaben, ersetzt je Match höchstens einen Stand und zählt niemals beide Versionen. Bei Konflikten werden vorläufige Werte gesondert markiert.

### 11.2 Lokaler Speicher

Empfehlung: Für die kritische Erfassung die native iOS-/Android-App mit SQLite verwenden. Expo SQLite bietet persistenten Speicher über App-Neustarts hinweg. Browser-Erfassung ist separat zu qualifizieren: Der aktuelle Web-Support von Expo SQLite ist als Alpha dokumentiert. Für Offline-Backoffice im Browser sind eine vorab geladene App-Hülle und persistierte Daten nötig. Gleichwertige Schreib-Dauerhaftigkeit im Browser wird nicht ungeprüft zugesagt. [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

**Umsetzungsstand:** `lib/station/store.ts` implementiert dieses Modell nativ mit `expo-sqlite` (WAL, `synchronous=FULL`, Tabellen `local_event_packages`, `local_checkins`, `local_result_submissions`, `local_outbox`, `local_result_drafts`, `local_live_states`, `local_team_visits`, `local_tool_state`); eine Ergebnisabgabe wird zusammen mit Sequenznummer und Outbox-Eintrag in einer Transaktion gespeichert, bevor die UI Erfolg meldet. `lib/station/store.web.ts` bietet dieselbe Schnittstelle auf AsyncStorage, ist aber wie oben beschrieben **nicht** für verlässliche Offline-Ergebnissicherung qualifiziert. Echte Geräte-Abnahmeszenarien aus Abschnitt 11.8 (Absturz vor/nach Commit, Neustart, Serverausfall) sind noch nicht auf echten Geräten durchgeführt; verifiziert wurden bislang die serverseitigen SQL-Szenarien (Idempotenz, Konflikt, Korrektur, Manifestlücke).

Das lokale Modell besteht aus einer lesbaren Eventkopie und einem unabhängigen Schreibjournal. Die Eventkopie darf aktualisiert oder neu aufgebaut werden; noch nicht abgeglichene Schreibdaten dürfen dadurch niemals verschwinden. Beim bewussten **Verlassen** der Veranstaltung wird nur die Sitzungsauswahl (Person, aktiver Check-in) und die Eventbindung gelöst (`station_state.left`), damit ein vorbereitetes Gerät nicht automatisch wieder in die Personenansicht springt; das Schreibjournal samt Sequenzzähler und Gerätezugang bleibt für einen späteren Beitritt erhalten und wird nie beim Verlassen gelöscht. Ein zusätzlicher, ausdrücklich bestätigter **Geräte-Reset** (`clearAllStationData`) löscht dagegen alle lokalen Daten einschließlich Geräte-ID und Journal und führt zurück zum Veranstaltungscode. Er ist die einzige Stelle, die unbestätigte Abgaben verwerfen darf, und muss sichtbar warnen; er ist über Personenauswahl, Beitritt und Sync-Screen erreichbar, damit niemand in einem Zustand ohne Ausweg festsitzt.

| Lokale Tabelle | Inhalt und Integrität |
|---|---|
| `local_event_packages` | PK `event_id`, `plan_version`, `schema_version`, `downloaded_at`, `verified_at`, `content_hash`; dazu atomar aktivierte relationale Eventkopien und lokal gespeicherte Medien. Ein abgebrochener Download ersetzt nicht das letzte vollständige Paket. |
| `local_result_drafts` | PK `match_id` innerhalb des gespeicherten Events, Eingabewerte, `updated_at`, `draft_version`. Automatisches lokales Sichern der Eingabe; die UI unterscheidet ungespeicherte Eingabe und bestätigten Entwurf. |
| `local_result_submissions` | PK `request_id`, `event_id`, `match_id`, `device_id`, `device_access_id`, `checkin_id`, `local_sequence`, angegebene Betreuungspersonen als Snapshot, `captured_at`, `plan_version`, `base_result_version`, vollständiger unveränderlicher `payload`, `payload_hash`; optional `supersedes_request_id` für einen Korrekturvorschlag. UUID wird einmal erzeugt und für jeden Retry beibehalten. Organisatorabgaben führen stattdessen den persönlichen Autor. |
| `local_outbox` | PK/FK `request_id → local_result_submissions`, `state` (`pending/sending/received`), `attempt_count`, `next_attempt_at`, `last_error`, optionaler `receipt`. Pro Abgabe genau ein Übertragungsauftrag. Fachstatus aus dem Empfangsbeleg bleibt davon getrennt. |
| `local_sync_state` | PK `event_id`, `device_id`, lückenlos vergebene nächste Sequenz, `last_download_at`, optionale Abschlussmeldung. Sequenz wird in derselben Transaktion wie die Abgabe erhöht; nur Ergebnisabgaben verbrauchen diese Sequenz. |
| `local_station_checkins` / `local_checkin_staff` | Lokale Entsprechungen der Check-in-Tabellen mit UUID, Belegung, Gerätezugang, Namen und Ein-/Auscheckzeit. Unabhängig vom Ergebnis speicherbar und später idempotent abgleichbar. Bei Ergebnissen wird ihr Check-in-Snapshot mitgesendet, damit ein fehlender vorheriger Upload keine Abgabe blockiert. |
| `local_tool_state` | PK `id`, Event/Spiel/optionaler Matchbezug, `tool_key`, `kind`, Zustand und Zeitpunkt. Timer-/Stoppuhrzustand, Zählerstand und gegebenenfalls Rundenzeiten werden lokal wiederhergestellt; keine zentrale Synchronisierung erforderlich. |
| `local_help_attempts` | PK `request_id`, Event-/Stationskontext, gewählte Nummer, Zeitpunkt, `status` (`started/unavailable/not_configured/cancelled`). Protokolliert ausgelöste Anrufe; ein Anrufversuch ist kein Ersatz für einen Notruf und wird nie als erfolgreich angezeigt, wenn er nicht gestartet werden konnte. |

```mermaid
erDiagram
    LOCAL_EVENT_PACKAGES ||--o{ LOCAL_RESULT_SUBMISSIONS : liefert_Planbasis
    LOCAL_RESULT_SUBMISSIONS ||--|| LOCAL_OUTBOX : muss_uebertragen_werden
    LOCAL_RESULT_SUBMISSIONS ||--o| RESULT_SUBMISSIONS : wird_bestaetigt
    RESULT_SUBMISSIONS ||--o| RESULT_REVISIONS : wird_gueltige_Revision
```

Die letzte Beziehung zwischen lokalem und zentralem Speicher ist logisch über dieselbe `request_id` verknüpft; es gibt keinen physischen Fremdschlüssel über das Netzwerk. Die 1:1-Beziehung zwischen Abgabe und Outbox wird durch gemeinsame Transaktion und Validierung erzwungen.

Beim Bestätigen werden sämtliche Teamwerte, die unveränderliche Abgabe, Sequenznummer und Outbox-Eintrag in **einer lokalen Transaktion** gespeichert. Erst nach erfolgreichem Commit zeigt die App die Bestätigung. Fehlschlag durch vollen Speicher oder Schreibfehler bleibt sichtbar; die App darf dann keinen Erfolg anzeigen. Lokale Transaktionen schützen vor halben Ergebnissen; SQLite dokumentiert dazu atomare Commits und deren Betriebssystem-/Hardwareannahmen. [SQLite: Atomic Commit](https://www.sqlite.org/atomiccommit.html)

Für die Umsetzung werden WAL, aktivierte Fremdschlüssel und ein auf Dauerhaftigkeit ausgelegter Synchronisationsmodus, beispielsweise `synchronous=FULL`, auf Zielgeräten geprüft. Migrationen und Wiederherstellung dürfen die Outbox niemals durch Löschen der Datenbank ersetzen. Ein Log-out sperrt die Datenansicht, löscht aber keine noch nicht abgeglichenen Abgaben. Ein Konto-/Gerätewechsel benötigt einen ausdrücklichen Übergabe- oder Wiederherstellungspfad.

### 11.3 Synchronisationsprotokoll

1. **Lokal sichern:** Abgabe und Auftrag gemeinsam committen. Online und offline benutzen genau denselben Schreibpfad.
2. **Übertragung versuchen:** Nach jeder Speicherung, bei App-Start, Rückkehr in den Vordergrund, wieder verfügbarer Verbindung und manuellem „Jetzt synchronisieren“. Bei Netz-/Serverfehlern mit wachsendem Abstand und zufälliger Streuung wiederholen. Keine endgültige Löschung nach einer Anzahl Fehlversuche.
3. **Sitzung prüfen:** Abgelaufene technische Sitzung bei bestehender Verbindung erneuern; bei verlorener Sitzung ist erneuter Codebeitritt beziehungsweise organisierte Gerätewiederherstellung nötig. Ein neuer anonymer Auth-Datensatz übernimmt keine alten Gerätezugänge allein aufgrund derselben behaupteten Geräte-ID. Solange dies nicht geklärt ist, bleiben Eingaben und Abgaben lokal erhalten. Organisatoren können sich separat wieder anmelden.
4. **Idempotent empfangen:** Server bindet Zugriff an die technische Sitzung und `device_event_access` beziehungsweise die Organisatorenmitgliedschaft. `request_id` plus kanonischer Inhalt verhindern doppelte Speicherung. Ausgewählte Namen sind Selbstauskunft. Ein Hash identifiziert Inhalt, beweist aber keine persönliche Autorenschaft. Ein mitgesendeter Check-in wird vor der Abgabe in derselben Transaktion geprüft und bei Bedarf angelegt.
5. **Journal und Wertung:** Innerhalb einer Transaktion wird die Abgabe dauerhaft gespeichert und entweder unter Matchsperre angewendet oder mit Konflikt-/Prüfstatus versehen. Nur `accepted` erzeugt die gültige Ergebnisrevision. Unberechtigte Requests erhalten keine Schreibrechte; ihre Originaldaten bleiben lokal für eine Wiederherstellung durch den Organisator erhalten.
6. **Empfang bestätigen:** Server liefert `request_id`, serverseitig überprüften Inhaltshash, Fachstatus und gegebenenfalls Revisionsnummer. Erst nach Prüfung und lokalem Commit dieses Belegs wird die Outbox als `received` markiert. Timeout bedeutet „Empfang unbekannt“ und führt zum Retry mit derselben ID.
7. **Stand laden:** Anschließend aktuelle Eventdaten und Ergebnisse in einem konsistenten Server-Snapshot abrufen und atomar in die lokale Lesekopie übernehmen. Lokale unbestätigte Abgaben bleiben separat erhalten. Für die geringe Datenmenge ist ein kompletter Eventabruf robuster als ein zunächst selbst entwickeltes Delta-Protokoll; keine Synchronisierung allein anhand von Gerätezeitstempeln.

Die App zeigt verständliche Zustände: **„Auf Gerät gespeichert“**, **„Übertragen“**, **„Klärung nötig“**. „Übertragen“ allein bedeutet bei einer Konfliktabgabe nicht „in der Tabelle gewertet“.

Nach einem Absturz werden zurückgebliebene `sending`-Aufträge erneut versucht. Ein Servercommit vor dem Absturz, dessen Antwort nie ankam, erzeugt beim Retry keine zweite Revision. Serverseitig bestätigte Originalabgaben bleiben zunächst auch lokal erhalten; Bereinigung erfolgt erst nach finalem Abgleich und festgelegter Aufbewahrung.

Hintergrundsynchronisation ist eine zusätzliche Gelegenheit. Das Betriebssystem entscheidet über die Ausführung; nach einem erzwungenen App-Ende kann sie ausbleiben. Verlässlich zugesagt wird deshalb das Wiederaufnehmen beim nächsten App-Start mit Verbindung, nicht ein Upload aus einer dauerhaft geschlossenen App. [Expo BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/)

### 11.4 Konflikte, Offline-Korrekturen und Planänderungen

Default: Je Match wird organisatorisch ein primär erfassendes Gerät vereinbart, mehrere berechtigte Geräte bleiben technisch möglich. Bei zwei widersprüchlichen Offline-Ergebnissen gewinnt nicht stillschweigend die spätere Geräteuhr. Der Server nimmt höchstens eine Abgabe auf passender Basisversion an; weitere Abgaben bleiben mit beiden Originalständen zur Klärung gespeichert. Nach expliziter Entscheidung erzeugt der Organisator eine neue Korrekturabgabe auf Basis der aktuellen Serverversion und referenziert die aufgelösten Abgaben.

Auch wenn zwei Geräte gleiche Werte melden, werden sie nicht doppelt gezählt. Die zweite Abgabe kann zunächst als Konflikt eingehen und anschließend als inhaltlich identisch aufgelöst werden. Jede Originalabgabe bleibt nachvollziehbar.

Offline-Korrekturen überschreiben eine bereits gespeicherte Abgabe nicht, sondern erzeugen eine neue mit Verweis auf die vorherige. Weil der Zielserverstand noch unbekannt sein kann, werden solche Vorschläge nach Übertragung dem Organisator zur Prüfung vorgelegt. Die App zeigt lokal den neuesten Vorschlag, ohne eine noch nicht vergebene Server-Revisionsnummer zu erfinden.

Der heruntergeladene Plan wird über `plan_version` identifiziert. Im Kernbetrieb wird er vor dem Tag festgelegt. Offline-Änderungen an der Planung können auf einem vorgesehenen Organisatorgerät als versionierter Änderungsentwurf gespeichert und bei Wiederverbindung gegen die Basisversion abgeglichen werden. Sie erreichen andere Geräte ohne Datenverbindung nicht automatisch. Während des Sporttags geänderte Paarungen/Regeln dürfen deshalb nicht stillschweigend alte Eingaben umdeuten: abweichende Abgaben werden gesichert und mit dem verwendeten Planstand geprüft.

Eine geänderte Namenszuordnung in der Einsatzplanung sperrt keine Stationsabgaben, weil die Betreuung im vertrauensbasierten Flow selbst gewählt wird. Ein bereits beendetes Event rechtfertigt keinen Datenverlust: Bei noch bestehendem Gerätezugang können verspätete Abgaben zur Prüfung gesichert werden, ohne sofort zu werten. Bei widerrufenem Gerätezugang ist ein organisierter Import des lokalen Sicherungspakets erforderlich. Ein Widerruf lässt sich nicht augenblicklich auf einem unerreichbaren Gerät durchsetzen; der Server prüft bei Wiederverbindung erneut.

### 11.5 Abschlussabgleich und zweite Kopie

Vor dem Sporttag werden die erwarteten Erfassungsgeräte in `event_device_states` registriert. Jedes Gerät vergibt pro Event eine monoton und lückenlos steigende Sequenz je gespeicherter Ergebnisabgabe. Beim endgültigen Abgleich übermittelt es sein Abschlussmanifest mit letzter Sequenz, allen Request-IDs und Inhaltshashes. Der Server prüft vollständigen Empfang bis zu dieser Sequenz und übereinstimmende Inhalte. Eine danach neu erfasste Abgabe hebt die vorherige Abschlussbestätigung wieder auf und erfordert ein neues Manifest.

Die Veranstaltung kann erst als **vollständig abgeglichen** gelten, wenn alle erwarteten Geräte bestätigt sind, jede angekündigte Abgabe zentral vorhanden ist, alle Konflikte bearbeitet sind und jedes gespielte Match ein gültiges Ergebnis hat. Nicht gespielte Matches müssen ausdrücklich als abgesagt markiert sein. Ein Gerät ohne Abgaben bestätigt ein leeres Manifest; ein verschwundenes Gerät wird nicht als leer angenommen. Die Anzeige „Server hat keine offene Warteschlange“ reicht nicht, weil der Server noch nie übertragene Daten nicht kennen kann.

Zusätzlich wird ein offline exportierbares Sicherungspaket vorgesehen: Event-/Gerätekennung, relevante Planversion, Originalabgaben, IDs, Hashes und Abschlussmanifest. Übertragung an ein zweites Gerät kann ohne Internet erfolgen, sofern ein lokaler Transport wie Dateiaustausch verfügbar ist. Der spätere Import ist idempotent; der Organisator wird als Importeur dokumentiert, die behauptete ursprüngliche Autorenkennung separat erhalten. Ein Import erhält durch die Datei keine automatisch vertraute Autorenschaft.

Das Paket wird aus einem konsistenten Snapshot erzeugt. Eine laufende SQLite-Datenbankdatei ohne zugehörigen WAL-Stand zu kopieren wäre keine verlässliche Sicherung. Zweite Kopien auf demselben Handy schützen nicht vor dessen Verlust. Für stärkeren Verlustschutz muss die Übergabe an ein zweites Gerät Teil des tatsächlichen Ablaufs sein.

### 11.6 Realtime und spätere Statusmeldungen

Bestätigt: Bei erreichbarem Netz fließen Abgaben fortlaufend in Supabase und damit in die Live-Tabelle des Backoffice. Die App verwendet Supabase Realtime für Live-Updates. `matches`, `result_submissions`, `result_revisions`, `result_values`, `match_live_states` und `team_station_visits` liegen dafür in der Publication `supabase_realtime`. Ein Signal stößt einen persistenten Neuabruf des betroffenen Eventstands und der Rangliste an; es selbst wird nicht als dauerhafte Wahrheit behandelt. Nach Verbindungsabbrüchen erfolgt ein vollständiger Neuabruf, damit verpasste Signale keine Datenlücke erzeugen. Zugriffe bleiben über RLS auf die berechtigte Veranstaltung begrenzt; öffentliches Streaming gehört nicht zum aktuellen Umfang.

**Laufender Zwischenstand:** Schon vor der Bestätigung meldet das Stationsgerät bei jeder Eingabe (z. B. „+“) einen Live-Zwischenstand über `sync_match_live` (Abschnitt 8.4). Beim ersten Eingriff wird das Match als `in_progress` markiert, sodass das Backoffice „läuft“ anzeigt; der mitlaufende Punktestand erscheint auf Karte und Stationsdetail. Der Zwischenstand ist ausdrücklich **nicht** revisionsbasiert und erzeugt keinen Konflikt: Mehrere Geräte derselben Station teilen einen Stand (Last-Write-Wins), jedes Gerät übernimmt eintreffende Stände in die Eingabefelder. Die verbindliche Wertung entsteht weiterhin ausschließlich über die revisionsbasierte Abgabe (`submit_result`); ein abgeschlossenes Match zeigt im Backoffice das bestätigte Ergebnis statt des Zwischenstands. Ohne Netz bleiben die lokalen Live-Stände maßgeblich und werden beim nächsten Sync nachgeholt.

„Nächste Gruppe ist unterwegs“ beantwortet inzwischen der Laufzettel aus Abschnitt 11.7: Eine weitergeschickte Gruppe ist genau die, die unterwegs ist. Eine darüber hinausgehende, zeitlich begrenzt gültige Statusmeldung bleibt möglich, ist aber nicht mehr nötig; sie dürfte die Ergebnissicherung nicht blockieren und nach Ablauf nicht nachgesendet werden.

### 11.7 Laufzettel der Gruppen und Zeitleiste

Die geplanten Uhrzeiten des Zeitplans sind am Veranstaltungstag eine Absicht, keine Zusage. Ein Block startet gemeinsam, eine Runde endet aber erst, wenn das letzte Spiel fertig ist. Dadurch verschieben sich die Gruppen gegeneinander: eine wartet an der Station, weil das Spiel davor noch läuft, eine andere ist früher fertig und zieht weiter. Die Uhrzeit beantwortet diese Lage nicht — die Frage lautet nicht „wie spät ist es", sondern „wie weit sind wir".

**Erfassung:** Am Kopf der Ergebnisseite führt das Stationsgerät je Gruppe einen Laufzettel: *Eingetroffen*, wenn die Gruppe an der Station ankommt, und *Ausschicken*, wenn sie weiterzieht. Beides ist ein einzelner Tipp und läuft über `sync_team_visit` (Abschnitt 8.5) — fortlaufend, nicht revisionsbasiert, offline lokal gespeichert und beim nächsten Sync nachgeholt. Ein dauerhaft abgelehnter Eintrag wird wie ein Live-Zwischenstand nicht endlos wiederholt; die nächste Eingabe setzt ihn erneut. Voraussetzung ist ein aktiver Check-in der Betreuung an dieser Stationsbelegung: Ohne ihn gibt es nichts zu melden.

**Ableitung** (`lib/live/timeline.ts`, gemeinsam für Backoffice und Stationsgerät):

- **Verzug** – Ankunft (ersatzweise Spielstart) gegenüber dem geplanten Rundenstart. Ein noch nicht erreichter Aufenthalt gilt nicht als verspätet, sondern als unbekannt.
- **Wartezeit** – Ankunft bis Spielstart: die Gruppe ist da, das Spiel läuft noch nicht.
- **Wegzeit** – Weiterschickung bis zur Ankunft an der nächsten Station.
- **Leerlauf je Station** – Lücke zwischen zwei tatsächlich belegten Matches. Eine Station gilt erst als frei, wenn *alle* Gruppen eines Matches weitergeschickt sind.

**Darstellung:** Im Live-Betrieb steht neben der Karte eine Zeitleiste als Gantt-Diagramm, umschaltbar nach Station oder nach Gruppe. Der helle gestrichelte Balken ist der Plan, der kräftige das Ist; die Lücke dazwischen ist der Overhead. Darüber stehen die Kennzahlen, die am Tag zählen: typischer Verzug, größter Verzug, wie viele Gruppen gerade warten, Leerlauf gesamt. Uhrzeiten bleiben als Achse und als kleine Nebenangabe erhalten — in der Stationsapp mit dem Zusatz „geplant ca.", damit ihr unverbindlicher Charakter sichtbar ist. Die ordnende Einheit in der Bedienung ist der Block bzw. die Runde, nicht die Uhr.

### 11.8 Verbindliche Abnahmeszenarien vor Einsatz

Diese Prüfungen sind Anforderungen an die spätere Implementierung, keine bereits bestandenen Tests:

- Vorbereitete App im Flugmodus kalt starten, alle Spielpläne/Regeln öffnen und einen vollständigen Sporttag erfassen; keine Online-Anmeldung erzwingen.
- App unmittelbar vor und nach lokalem Commit beenden: Entweder keine Erfolgsanzeige oder nach Neustart vollständige Abgabe samt Outbox, niemals eine bestätigte halbe Abgabe.
- Gerät zwischen Speicherung und Upload neu starten; alle bestätigten Werte wiederherstellen.
- Server nimmt Abgabe an, Antwort geht verloren: Retry erzeugt genau eine gültige Revision.
- Zwei Geräte erfassen unterschiedliche Ergebnisse für dasselbe Match: Beide Originale bleiben erhalten, Konflikt sichtbar, Tabelle zählt nur einen gültigen Stand.
- Abgelaufenes Token, entzogene Rechte, voller Speicher und längerer Serverausfall führen zu sichtbaren Zuständen ohne heimliche Löschung.
- Offline-Korrektur und veralteter Plan werden erhalten und nachvollziehbar geklärt.
- Export auf ein zweites Gerät, Import nach Verlust des ursprünglichen Geräts und erneuter Import desselben Pakets rekonstruieren Ergebnisse ohne Doppelwertung.
- Erst am Ende alle Geräte verbinden: Manifestabgleich findet fehlende Abgaben und Geräte; die Tabelle lässt sich vollständig aus zentralen Revisionen berechnen.
- Codebeitritt benötigt keinen persönlichen Account; Stationswahl und Check-in funktionieren nach Vorbereitung offline, auch für zwei Personen an derselben Station.
- Zwei Geräte an derselben Station zählen parallel: Der Live-Zwischenstand wird geteilt, beide Geräte sehen den Status „läuft“ und den mitlaufenden Punktestand, ohne dass ein Konflikt oder Korrekturvorschlag entsteht; die endgültige Wertung kommt weiterhin nur aus der bestätigten Abgabe.
- Eine Gruppe wird offline eingecheckt und ausgeschickt; nach dem Sync zeigen Backoffice und ein zweites Gerät derselben Station denselben Laufzettel, ohne dass ein Ergebnis oder eine Revision berührt wird.
- Eine Runde zieht sich, die Folgegruppe wartet: Zeitleiste und Kennzahlen zeigen Verzug und Wartezeit, ohne dass der Plan verändert werden muss.
- Eventcode-Zugang erlaubt keine Backoffice-Änderungen und keinen Zugriff auf fremde Veranstaltungen.
- Satellitenbild, Pins, Spielregeln und Werkzeuge funktionieren im Flugmodus nach Kaltstart.

Der Entwurf definiert damit die erforderlichen Sicherungen. Eine Belastbarkeitszusage für den echten Sporttag setzt die Umsetzung und Tests auf den eingesetzten Geräten voraus.

## 12. Bestätigter Stationsmanager-Flow

1. **Veranstaltung beitreten:** In der Sporthalle den gemeinsamen Code eingeben. Kein persönliches Konto, keine E-Mail, kein Passwort. Beim ersten Beitritt werden Gerätezugang und Offline-Paket eingerichtet. Voraussetzung ist dann noch eine Verbindung zum Backend; danach ist der Sporttagsbetrieb offline möglich.
2. **Aufgabe auswählen:** Block und Station auswählen, zum Beispiel „Block 1 · Station 1 · Ballspiel · Joel und Elias“. Die Namen stammen aus der Einsatzplanung. Man kann angeben, wer tatsächlich dort ist, auch mehrere Personen gemeinsam. Ein einzelnes Gerät kann für die gesamte Betreuung genutzt werden.
3. **Station finden:** Die gespeicherte Satellitenübersicht hebt die gewählte Station hervor. Alle anderen Stationspins bleiben zur Orientierung sichtbar. Ein kurzer Anreisehinweis kann ergänzen: „hinter der Sporthalle am Waldrand“. Das ist Orientierung über eine Karte, zunächst keine automatische Fußgängerroutenberechnung.
4. **Einchecken:** Vor Ort „Station übernehmen“ betätigen. Das speichert den Check-in auf dem Gerät. Es gibt keine verpflichtende GPS-Prüfung und keine blockierende Exklusivsperre, wenn Elias auf einem zweiten Handy ebenfalls eincheckt.
5. **Stationsübersicht:** Aktueller Block, aktuelles und nächstes Match, beteiligte Teams, Regeln und Werkzeuge erscheinen aus dem Offline-Paket. Auf ein Match tippen öffnet dessen Durchführung und Ergebniseingabe.
6. **Durchführen und erfassen:** Lokale Werkzeuge bei Bedarf verwenden, Ergebnisse bestätigen, lokale Speicherbestätigung sehen. Bei Verbindung synchronisiert die App; ohne Verbindung bleibt die Arbeit vollständig möglich.
7. **Block-/Stationswechsel:** Nächste Belegung auswählen, Ziel auf der Karte ansehen und dort neu einchecken. Der alte Check-in wird lokal beendet, ohne alte Ergebnisse oder Werkzeugstände zu löschen. Andere Betreuer können an der alten Station verbleiben.

```mermaid
flowchart TD
    A[Veranstaltungscode eingeben] --> B[Gerätezugang und Offline-Paket vorbereiten]
    B --> C[Block, Station und Betreuung auswählen]
    C --> D[Station auf gespeicherter Satellitenkarte finden]
    D --> E[Vor Ort einchecken]
    E --> F[Matches, Regeln und Werkzeuge öffnen]
    F --> G[Ergebnis lokal speichern]
    G --> H{Verbindung verfügbar?}
    H -->|Ja| I[Automatisch synchronisieren]
    H -->|Nein| J[Gesichert auf Gerät, später synchronisieren]
    I --> F
    J --> F
    F --> K[Block oder Station wechseln]
    K --> C
```

Der aktuell gewählte Block wird anhand der Planzeiten vorgeschlagen, ist aber manuell wählbar. Gerät und Uhrzeit dürfen verspätete Runden nicht unbedienbar machen. Die sichtbare Erfassungsauswahl begrenzt den Arbeitskontext, nicht die Identität der Person. Ein versehentlich falsch ausgewählter Name wird im Check-in berichtigt; bereits bestätigte Ergebnisabgaben behalten ihren historischen Namenssnapshot.

## 13. Backoffice: Geländeplan und Einsatzplanung

### Feste Stationen, wechselnde Belegungen

Im Backoffice wird für den Sporttag ein Kartenausschnitt festgelegt. Auf einer Satellitenkarte werden die vorhandenen Stationen per Pin positioniert. Das verschiebt die Koordinaten der Station, nicht die Koordinaten eines einzelnen Matches. Alle Blöcke und Runden benutzen denselben Stationsstandort. Während des Sporttags bleiben die Standorte fest; Änderungen erfolgen vor dem erneuten Freigeben eines versionierten Offline-Pakets.

Beispiel:

| Ort | Block 1 | Block 2 |
|---|---|---|
| Station 1, derselbe Pin | Ballspiel · Joel und Elias | Fähnchen klauen · Mia und Ben |
| Station 2, derselbe Pin | Geschicklichkeit · Lea | Ballspiel · Joel und Elias |

Das vorhandene Modell `station_setups` trägt das Spiel je Block. `station_assignments` trägt beliebig viele geplante Betreuungspersonen je Belegung. Teams kommen über die Matches hinzu. Die Reihenfolge im Backoffice kann deshalb sein: Gelände und Stationen → Blöcke/Runden → Spiele und Betreuung je Station/Block → Begegnungen und Teams → Wertung prüfen → Offline-Paket freigeben.

### Interaktive Planungskarte (Backoffice)

Umgesetzt: Der Kartenausschnitt (`events.venue_north/south/east/west`) wird im Backoffice auf einer interaktiven Satellitenkarte per Antippen zweier gegenüberliegender Ecken gezeichnet, nicht nur konzeptionell vorgesehen. Stationen werden ebenfalls per Antippen der Karte platziert (Alternative: manuelle Koordinateneingabe im Formular). Kartenengine ist MapLibre (`@maplibre/maplibre-react-native`) nativ und Leaflet im Web, unter `components/map/`; als Kachelquelle dienen offene, tokenfreie Dienste: Esri World Imagery (Satellitenbild) plus die Esri-Referenzebene „World Boundaries and Places“ für Orts-/Straßennamen, beides öffentliche ArcGIS-Online-Dienste ohne Account/API-Key, dazu Nominatim (OpenStreetMap) für die Ortssuche. Damit ist der zuvor offene Kartenanbieter für die **Backoffice-Bearbeitungsansicht** festgelegt. Das Gelände-Rechteck ist unabhängig vom gebackenen Offline-Kartenstand (`event_maps`) nutzbar, da Letzterer ein bereits gerendertes Bildasset voraussetzt, das Rechteck aber schon vor dessen Erstellung existiert.

### Offline-Kartenbild

Die Basis ist ein versioniertes, nordorientiertes Satellitenbild mit bekanntem geografischem Ausschnitt und Projektion. WGS84-Stationskoordinaten sind die einzige Quelle für die Pins; Bildschirmpositionen werden passend zur Bildprojektion berechnet. Eine bloß lineare Umrechnung von Breitengraden auf einem Mercator-Bild wird nicht verwendet. Beim Zoomen und Drehen des Bildes werden Pins mit derselben Transformation bewegt, damit sie am richtigen Ort bleiben.

**Umsetzungsstand:** Die Stationskarte (`app/(station)/map.tsx`) zeigt aktuell die reale, aber weiterhin **online** geladene `SatelliteMap` mit den echten Stationskoordinaten aus dem Offline-Paket, nicht das hier beschriebene gebackene Offline-Bild. Ein Offline-Kachel-Prefetch für die tokenfreien Esri-Kacheln ist noch nicht umgesetzt; ohne Netz am Stationsort fällt die Karte auf den einfachen Pin-Platzhalter zurück. Das bleibt eine offene Lücke gegenüber der Offline-Anforderung in Abschnitt 11.1.

Das gewählte Kartenmaterial muss die vorgesehene Offline-Nutzung erlauben. Ein Anbieter für dieses gebackene Offline-Bild ist noch nicht festgelegt; der Entwurf setzt deshalb keine konkrete Karten-API dafür voraus (unabhängig von der oben beschriebenen Esri-Kachelquelle der Live-Planungskarte im Backoffice). Ein beliebiger Screenshot ohne Georeferenz reicht nicht für verlässlich platzierte Geo-Pins. Bei hochgeladenen Bildern müssen Grenzen und Projektion hinterlegt beziehungsweise das Bild zuvor passend aufbereitet werden.

Das fertige Bild liegt als versioniertes Asset vor. Das Offline-Paket enthält die Bilddatei, Prüfsumme, Kartengrenzen, Stationskoordinaten und Anreisehinweise. Zur Laufzeit werden keine Online-Kacheln benötigt. Ein Download ist erst vollständig, wenn auch die Karte lokal geprüft vorliegt. Ein eigener Positionspunkt per Geräteortung ist eine optionale Ergänzung; verweigerte Standortfreigabe darf Karte, Stationswahl und Check-in nicht blockieren.

## 14. Lokale Spielwerkzeuge und Hilfeanruf

### Timer, Stoppuhr und Zähler

`tools_config` wird von der Vorlage in das Veranstaltungsspiel kopiert. Die Konfiguration enthält pro Werkzeug einen stabilen `key`, `type`, `label` und typspezifische Optionen. Beispiel: ein Timer mit 600 Sekunden, eine Stoppuhr und ein Zähler pro teilnehmendem Team mit Startwert 0 und Schrittweite 1. Die Konfiguration wird validiert; ausführbarer Code gehört nicht hinein.

Laufzustände werden ausschließlich in `local_tool_state` gespeichert. Ein Timer speichert Dauer, Start-/Zielzeit und Pausenzustand; eine Stoppuhr den Startpunkt, bereits akkumulierte Zeit und gegebenenfalls Rundenzeiten. Die Anzeige wird aus diesen Werten berechnet und hängt nicht davon ab, ob jede Sekunde ein JavaScript-Callback ausgeführt wurde. Während einer laufenden Sitzung wird eine monotone Zeitbasis verwendet; nach Neustart erfolgt die Rekonstruktion anhand gespeicherter Zeitpunkte. Unplausible Änderungen der Geräteuhr müssen erkennbar sein, statt eine Messung als sicher korrekt auszugeben.

Zählerschritte werden unmittelbar lokal persistiert. Ein Zurücksetzen ist eine ausdrückliche Werkzeugaktion und löscht kein Match-Ergebnis. Werkzeugstände dürfen nach bewusster Bestätigung in die Ergebniseingabe übernommen werden; ein Counter ist nicht automatisch schon ein verbindliches Ergebnis. Zwei Geräte teilen ihre Timer und Zähler zunächst nicht. Nur bestätigte Ergebnisabgaben werden wie in Abschnitt 11 synchronisiert.

### Hilfe per nativem Anruf

Bestätigter Umfang: In der Stationsansicht stehen zwei große Aktionen „Assistenz“ und „Medizinisch“. Jede startet einen **nativen Anruf** (`tel:`) auf eine konfigurierte Rufnummer (`EXPO_PUBLIC_ASSISTANCE_PHONE`, `EXPO_PUBLIC_MEDICAL_PHONE`); im Zielmodell stammen die Nummern aus der Veranstaltungseinstellung. Der „wie ein Anruf klingelnde“ Alarm auf Empfängerseite wird über den Telefon-/Benachrichtigungsdienst des Empfängers konfiguriert, nicht durch die App.

Die App zeigt ausschließlich den Startzustand: „Anruf gestartet“, „Anruf nicht möglich“ oder „Keine Nummer hinterlegt“. Ein nicht gestarteter Anruf wird nie als erfolgreich angezeigt. Ob der Angerufene abnimmt, ist nicht Bestandteil der App.

Medizinische Falldaten und ein eigenes Erste-Hilfe-System sind nicht Bestandteil dieses Entwurfs. Die App ersetzt keinen Notruf; die Rufnummern müssen vorab festgelegt und geprüft sein.

Zusätzliche Abnahmeszenarien: Zwei Geräte übernehmen dieselbe Station ohne Sperre; ein Offline-Check-in samt Ergebnis wird gemeinsam nachgeliefert; Pins bleiben nach Zoom und Bildneuladen korrekt; Timer und Zähler überstehen App-Neustarts; Codezugang erlaubt keine Backoffice-Schreibrechte; ein Gerät ohne Telefonie zeigt einen Hilfeanruf niemals als gestartet an.
