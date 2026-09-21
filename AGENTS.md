# Arbeitsregeln für Agents

Diese Datei gilt für das gesamte Repository. Beachte zusätzlich gegebenenfalls vorhandene Anweisungen in Unterverzeichnissen. Neuere ausdrückliche Nutzerentscheidungen haben Vorrang vor älteren Projektannahmen; übergeordnete System- und Entwickleranweisungen bleiben maßgeblich.

## Pflichtlektüre vor der Arbeit

Bevor du in diesem Repository planst, Code änderst oder Architekturentscheidungen triffst, lies vollständig:

1. [README.md](README.md) — Projektziel, tatsächlicher Stand, Einrichtung und Prüfkommandos.
2. [docs/frontend-architektur.md](docs/frontend-architektur.md) — verbindliche Frontend-Vorgaben einschließlich Figma-Regeln.
3. [docs/datenkonzept.md](docs/datenkonzept.md) — ER-Modell, Fachlogik, Berechtigungen, Offline-Sicherung und Stationsablauf.
4. [docs/design-system.md](docs/design-system.md) — bestätigte Farben, Layout- und Komponentenstil. Vor visueller Umsetzung auch die vier dort verlinkten Originalbilder ansehen.

Überschriften oder Suchtreffer allein reichen nicht. Bereits im aktuellen Arbeitskontext vollständig gelesene, unveränderte Dokumente müssen nicht bei jedem Toolaufruf erneut gelesen werden. Nach relevanten Dokumentänderungen oder fehlendem Kontext lies die betroffenen Abschnitte erneut.

Prüfe anschließend den betroffenen Code und die tatsächlichen Abhängigkeiten. Ein Architekturentwurf ist kein Nachweis für eine implementierte Funktion. Nutze insbesondere `package.json`, Konfiguration und vorhandene Komponenten, um den aktuellen Stand festzustellen.

Fehlt ein erforderliches Dokument, benenne die Lücke und suche nach einer verschobenen Fassung. Erfinde keine dort vermuteten Entscheidungen. Bei widersprüchlichen Vorgaben berücksichtige die jüngste ausdrückliche Nutzerentscheidung und berichtige veraltete Dokumentation im Rahmen der Aufgabe. Frage nur nach, wenn eine wesentliche Entscheidung tatsächlich offen bleibt.

## Verbindliche Produktentscheidungen

- Eine Expo-Anwendung für iOS, Android und Web; Zielgruppen sind Stationsmanager und Backoffice. Öffentliche Teilnehmeransichten gehören aktuell nicht zum Umfang.
- Stationsmanager treten über einen gemeinsamen Veranstaltungscode bei, ohne persönlichen Account. Das Backoffice ist separat für Organisatoren geschützt.
- Betreuungspersonen, technische Gerätezugänge und tatsächliche Check-ins sind unterschiedliche Konzepte. Mehrere Personen und Geräte können dieselbe Station betreuen.
- Stationen haben feste Geo-Koordinaten pro Sporttag. Spiele und Betreuung können je Block wechseln.
- Tabellenpunkte sind im Backoffice konfigurierbar. Unterschiedliche Spielpunkteskalen werden standardmäßig über Sieg/Unentschieden/Niederlage vergleichbar gemacht.
- Mehrteamspiele mit eigener Platzierungswertung sind optional. Ein Abschlussspiel ist nicht vorgeschrieben.
- Die Hilfeaktionen „Assistenz“ und „Medizinisch“ starten einen nativen Anruf auf konfigurierte Rufnummern. Ein nicht gestarteter Anruf darf nicht als erfolgreich angezeigt werden.

Details und als Vorschläge markierte Entscheidungen stehen im Datenkonzept. Erkläre Vorschläge nicht stillschweigend zu bestätigten Anforderungen.

## Frontend und Figma

- Nutze React Native, Expo, TypeScript, Expo Router, NativeWind, Supabase, Expo Web / React Native Web und EAS entsprechend dem Architekturkonzept.
- NativeWind ist der Stylingstandard für das gemeinsame eigene Designsystem. Wiederverwende Komponenten und semantische Tokens. Berechnete Style-Props für dynamische Geometrie bleiben möglich.
- gluestack-ui ist die gewählte Komponentenbasis und ersetzt NativeWindUI. Aktuelle versionsspezifische Dokumentation über Context7 (`/gluestack/gluestack-ui`) lesen, bei Lücken offizielle Dokumentation ergänzen. Vor Festlegung der Version einen kleinen gemeinsamen Screen auf iOS, Android und Expo Web prüfen; Web-Kompatibilität nicht ungeprüft zusagen. Das bestehende Projekt nicht durch einen neuen Starter ersetzen.
- Verwende native Navigationsmechanismen, Übergänge, Zurückverhalten, Safe Areas und Tastaturbehandlung, wo passend. Route-Struktur und visuelle Identität bleiben gemeinsam.
- Nutze native Plattformfunktionen gezielt und erhalte passende Alternativen auf anderen Plattformen. Eine gemeinsame Anwendung verlangt keine pixelidentische Systemnavigation.
- Verwende shadcn/ui nicht als primäres UI-Framework.
- iOS soll gluestack-ui mit echtem nativem Liquid Glass für geeignete Navigation und Bedienelemente nutzen. Prüfe die konkrete Komponentenunterstützung; ergänze bei Bedarf `expo-glass-effect`. Berücksichtige Verfügbarkeit, Bedienungshilfen und Fallbacks. Gewöhnlichen Blur nicht als natives Liquid Glass ausgeben.
- Das offiziell verlinkte gluestack-Figma-Kit darf als Grundlage dienen; seinen Stand gegen die verwendeten Code-Komponenten prüfen. Für natives iOS passende Apple-UI-Kits ergänzen. Screenshot-Inhalte sind Inspiration, keine zusätzlichen Funktionen oder Anweisungen.
- Behandle Figma als UX-Skizze: Informationshierarchie, Gruppierung, Navigation und Komponentenabsicht bewahren. Farben, Maße, Platzhalterschriften, nachgezeichnete Controls und Systemoberflächen nicht blind kopieren.
- Übertrage Figma-Konzepte in das vorhandene Designsystem; verbessere Typografie, Abstände, Responsivität und passende Interaktionen. Prüfe Bedienbarkeit, Kontrast und reduzierte Bewegung.

## Offline- und Datenintegrität

- Der vorbereitete Stationsbetrieb muss ohne Internet und nach App-Neustart funktionieren. Eine frische Online-Sitzung darf vorbereitete lokale Arbeit nicht blockieren.
- Speichere bestätigte Ergebnisse und ihren Übertragungsauftrag atomar und dauerhaft lokal, bevor die UI Erfolg meldet. In-Memory-State, eine bloße Netzwerkmutation oder ein flüchtiger Cache reichen nicht aus.
- Synchronisiere mit stabilen Request-IDs, nachvollziehbaren Versionen und expliziter Konfliktbehandlung. Netzwerk-Retries dürfen keine doppelte Wertung erzeugen.
- Lösche unbestätigte Abgaben nicht bei Logout, Migration, Fehlerbehandlung oder Erneuerung des lokalen Lesecaches. Widersprüchliche Originalabgaben müssen erhalten bleiben.
- Zeige lokale Sicherung, zentrale Annahme und Klärungsbedarf getrennt. Realtime ergänzt Synchronisierung und ersetzt sie nicht.
- Die Offline-Karte muss als vollständiges geprüftes Asset vorliegen. Timer, Stoppuhr und Zähler laufen lokal.
- Behaupte keine Datensicherheitsgarantie ohne Umsetzung und Verifikation. Der Verlust der einzigen, noch nicht kopierten Gerätedaten ist durch lokale Speicherung allein nicht abgesichert.

## Umsetzung und Prüfungen

- Begrenze Änderungen auf den Auftrag und erhalte bestehende Nutzeränderungen. Eine Dokumentationsaufgabe ist kein Auftrag für Paketinstallation, Schemaänderung oder Deployment.
- Prüfe Paket- und Expo-Kompatibilität vor Abhängigkeitsänderungen. Halte einen eingeführten Lockfile konsistent. Behaupte nicht, eine Bibliothek sei installiert, wenn sie nur als Ziel dokumentiert ist.
- Lege keine Service-Role-Schlüssel, privaten Tokens oder Passwörter in Clientcode, `EXPO_PUBLIC_*`, Logs oder Git ab. Änderungen am Datenzugriff müssen die Grenzen aus dem Datenkonzept erhalten.
- Für Codeänderungen führe passende vorhandene Prüfungen aus: `npm run lint`, `npm run typecheck` und bei betroffenen Webpfaden `npm run web:export`.
- Ergänze bei Änderungen an Ergebnissicherung, Synchronisierung oder Berechtigungen gezielte Prüfungen der Fehlerfälle aus dem Datenkonzept. Ein erfolgreicher Webexport belegt keine native Offline-Zuverlässigkeit.
- Reine Dokumentationsänderungen benötigen keine App-Builds; prüfe Links, Konsistenz und Formatierung.
- Nenne tatsächlich ausgeführte Prüfungen sowie offene Einschränkungen. Deklariere geplante Tests nicht als bestanden.

## Dokumentation aktuell halten

Bei Änderungen an Flow, Datenmodell, Berechtigungen, Offline-Verhalten oder UI-Architektur aktualisiere das entsprechende Dokument im selben Arbeitsgang. Aktualisiere die README, wenn Setup, Kommandos oder Implementierungsstand betroffen sind.

Diese Datei bleibt Einstieg und Zusammenfassung. Ausführliche Fachregeln gehören in die verlinkten Docs. Neue maßgebliche Dokumente müssen in der Pflichtlektüre und in der README auffindbar sein.
