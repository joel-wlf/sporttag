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

Stationsmanager geben einen gemeinsamen Veranstaltungscode ein und benötigen keinen persönlichen Account. Nach dem vorbereitenden Download wählen sie Station, Block und Betreuung, orientieren sich auf der gespeicherten Satellitenübersicht, checken ein und öffnen ihre Matches, Regeln und lokalen Werkzeuge.

Das separat geschützte Backoffice verwaltet Veranstaltungen, Teams, feste Stationsstandorte, Spiele, Blöcke, Runden, Betreuung und konfigurierbare Tabellenpunkte. Mehrere Personen dürfen dieselbe Station betreuen. Mehrteamspiele sind optional; ein Abschlussspiel ist nicht vorgeschrieben. Öffentliche Teilnehmeransichten gehören derzeit nicht zum App-Umfang.

Ergebnisse sollen zuerst dauerhaft lokal gesichert und bei Verbindung automatisch synchronisiert werden. Ein vollständiger Abgleich erst am Ende muss möglich sein. Die App erhält Live-Updates über Supabase Realtime; Realtime ergänzt die persistente Synchronisierung und ersetzt sie nicht. Die optionale ntfy-Hilfeaktion benötigt Verbindung und zeigt ihren Versandstatus ausdrücklich an.

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

Das Repository enthält ein Expo-Grundgerüst mit Router, Login-/Session-Grundlagen, Supabase-Client, einfachen Screens, Theme und EAS-Konfiguration. Das fachliche Supabase-Schema liegt als erste Migration unter `supabase/migrations/`; es umfasst RLS, versionierte Ergebnisabgaben, Ranglistenviews und die Realtime-Publication. Die vorhandenen Tabs verwenden derzeit `Tabs` aus Expo Router; die gewünschte native Tab-Umsetzung ist damit noch nicht als fertig nachgewiesen.

Die Docs beschreiben die Zielarchitektur. **NativeWind ist noch nicht installiert; gluestack-ui-Komponenten wurden noch nicht übernommen.** Codebeitritt, Stationsbetrieb, Satellitenkarte, lokale Werkzeuge, ntfy-Integration, Realtime-Abonnements im Client und robuste Offline-Ergebnissicherung sind noch nicht implementiert. Der bisherige Login-Flow ist ein Starter und entspricht noch nicht dem vorgesehenen Codezugang.

Dieses Grundgerüst ist noch keine für den Offline-Einsatz geprüfte Sporttag-App.

## Projektstruktur

```text
app/                     Expo-Router-Routen und Layouts
components/ui/           bisherige UI-Grundlagen und Theme
components/platform/     bisherige plattformspezifische Oberfläche
providers/               Session-Verwaltung
hooks/                   gemeinsame Hooks
lib/                     unter anderem Supabase-Client
assets/branding/app-icon/ plattformspezifische App-Icon-Quellen und Exporte
assets/icons/             eigenständige UI-Symbole, darunter das Läufermotiv
docs/                    Frontend- und Datenkonzept
AGENTS.md                Arbeitsregeln für Agents
```

Die App-Icon-Konfiguration liegt in `app.json`: iOS verwendet das Icon-Composer-Projekt, Android ein Adaptive Icon mit eigener Vordergrund- und Monochromebene, Web ein Favicon. Das Läufer-SVG unter `assets/icons/` ist davon getrennt und für die spätere Verwendung innerhalb der UI vorgesehen.

Die geplante Komponentenstruktur unter `components/ui/` und `components/layout/` steht im Frontend-Konzept. Bestehende Starter-Komponenten werden bei Umsetzung passend weiterentwickelt.

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
```

In `EXPO_PUBLIC_*` gehören ausschließlich für Clients bestimmte Konfigurationswerte und öffentliche Client-Schlüssel. Service-Role-Schlüssel und private Tokens bleiben serverseitig. Reale Zugangsdaten nicht committen.

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
