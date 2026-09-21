# Frontend-Architektur der Sporttag-App

Stand: 20.09.2026 · Verbindliche Vorgaben aus dem UI-Handover

Dieses Dokument ersetzt die vorherige Empfehlung, das gemeinsame Designsystem primär mit React Native `StyleSheet` umzusetzen. Es beschreibt die Zielarchitektur; die technische Umstellung ist noch nicht implementiert. Das übermittelte Handover endet bei `components/layout/Header.tsx`; weitere nicht übermittelte Vorgaben werden nicht vorausgesetzt.

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

**Versionswahl noch offen:** Die recherchierte v5-Dokumentation nennt Einschränkungen im Web-Unterbau mit NativeWind v5. Deshalb nicht ungeprüft `latest` übernehmen. Zuerst einen kleinen Screen mit Button, Eingabe, Auswahl und Modal auf iOS, Android und Expo Web prüfen, einschließlich Tastaturbedienung, Fokus und nativer Integration. Erst nach diesem Test die konkrete Paketkombination festschreiben. Dieser Test ist vereinbart, noch nicht ausgeführt. [Installationshinweise v5](https://v5.gluestack.io/ui/docs/home/getting-started/installation)

Gemeinsame visuelle Identität und Informationsarchitektur bleiben maßgeblich; gluestack ersetzt weder Expo Router noch die Offline-Datenschicht.

## Navigation

Route-Hierarchie und Informationsarchitektur bleiben gemeinsam. Expo Router organisiert Codebeitritt, Stationswahl, Geländeübersicht, Stationsbetrieb, Matches und das getrennt geschützte Backoffice.

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
  layout/
    Screen.tsx
    Section.tsx
    Header.tsx
```

Diese Struktur verwendet die vorgeschlagenen Bausteine aus dem Handover und integriert passende gluestack-Komponenten unter `components/ui/`. `components/ui/` stellt die gemeinsamen Projektkomponenten bereit und verwendet beziehungsweise exportiert passende gluestack-ui-Bausteine, ohne identische Komponenten doppelt zu implementieren. Weitere Komponenten werden bei konkretem Bedarf ergänzt. Plattformdateien wie `.ios.tsx`, `.android.tsx` oder `.web.tsx` sind für gezielte Unterschiede möglich; ihre gemeinsame Schnittstelle bleibt gleich.

**iOS soll gluestack-ui mit echtem nativem Liquid Glass verwenden.** `GlassSurface` ist eine gemeinsame Komponente mit plattformgeeigneter Darstellung. Auf unterstützten iOS-Versionen wird der native Effekt gezielt für Navigation und geeignete schwebende Bedienelemente eingesetzt. Andere Plattformen und ältere iOS-Versionen erhalten eine zur selben Gestaltung passende Oberfläche. Inhalte, Hierarchie und Bedienung bleiben gemeinsam.

gluestack-ui-Komponenten sind nicht automatisch sämtlich Liquid-Glass-Komponenten. Native Tabs und Stack-Navigation bleiben bei Expo Router; inhaltliche Tabs aus einer Komponentenbibliothek ersetzen keine native App-Navigation. Zusätzliche Glasoberflächen werden über `expo-glass-effect` integriert; Expo SDK 57 dokumentiert dafür native `GlassView`-Unterstützung ab iOS 26. Verfügbarkeit, Bedienungshilfen und Fallback werden zur Laufzeit berücksichtigt. Ein gewöhnlicher Blur oder eine halbtransparente Fläche ist kein Nachweis für natives Liquid Glass. [Expo GlassEffect](https://docs.expo.dev/versions/v57.0.0/sdk/glass-effect/)

Liquid Glass ersetzt nicht jede Inhaltsfläche: Spielstände, Texte und Eingaben müssen insbesondere draußen gut lesbar bleiben. Gemeinsame Tokens und gluestack-ui-Komponentenschnittstellen gelten weiterhin. Der bereits vorhandene `expo-glass-effect`-Eintrag und `PlatformSurface` sind ein Ausgangspunkt, keine abgeschlossene Integration.

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

Der bestätigte Stationsablauf bleibt: Veranstaltungscode → Station/Block und Betreuung wählen → Geländeübersicht → Check-in → Matches, Regeln und Werkzeuge → Ergebniserfassung.

Auf Smartphones stehen große bedienbare Flächen, klare Spielstände und sichtbare Speicherzustände im Vordergrund. Das Backoffice nutzt auf breiten Bildschirmen mehr Platz für Planung, Tabellen und Karten. Beide verwenden dieselben Design-Tokens und geeignete gemeinsame Komponenten.

Die Oberfläche liest aus dem lokalen Datenmodell. Speichern, Wiederherstellung und Synchronisation liegen außerhalb der UI-Komponenten. Ein Wechsel des Designs oder eine plattformspezifische Darstellung darf die Offline-Ergebnissicherung nicht verändern.

Die Geländeübersicht und Stationspins funktionieren mit dem vorbereiteten Offline-Kartenmaterial. Eine plattformspezifische Kartenbearbeitung im Backoffice ist möglich, solange sie dieselben Stationskoordinaten und Kartenstände erzeugt.

Native Möglichkeiten wie Haptik, System-Dateifreigabe für Sicherungspakete oder lokale Timer-Benachrichtigungen sind sinnvolle Kandidaten, aber durch dieses Architektur-Handover noch keine einzeln beauftragten Funktionen. Sie werden bei ihrer Umsetzung auf Plattformverfügbarkeit und Offline-Verhalten geprüft.

## Abgrenzung zum aktuellen Projektstand

Expo Router, TypeScript, React Native Web und Supabase sind im vorhandenen Projekt bereits vorgesehen. NativeWind ist laut geprüftem `package.json` noch nicht installiert; gluestack-ui-Komponenten wurden noch nicht übernommen. Das bisherige Theme und `PlatformSurface` sind Ausgangspunkte für die spätere Überführung in das gemeinsame Designsystem.

Dieses Dokument bestätigt die Zielrichtung. Es nimmt keine Paketinstallation, SDK-Aktualisierung oder UI-Implementierung vor.
