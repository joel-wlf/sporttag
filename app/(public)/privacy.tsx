import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { LegalList, LegalParagraph, LegalSection } from '@/components/legal/LegalBlocks';
import { Button } from '@/components/ui/Button';
import { LEGAL_CONTROLLER, POLICY_UPDATED, SUPPORT_EMAIL } from '@/lib/legal';

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <Screen size="narrow">
      <Header
        description={`Stand: ${POLICY_UPDATED}. Sporttag unterstützt die Durchführung von Sporttagen auf Jugendfreizeiten. Diese Seite erklärt, welche Daten dafür verarbeitet werden – und welche nicht.`}
        eyebrow="RECHTLICHES"
        onBack={router.canGoBack() ? () => router.back() : undefined}
        title="Datenschutzerklärung"
      />

      <LegalSection title="Kurzfassung">
        <LegalList
          items={[
            'Kein Tracking, keine Werbung, keine Analyse- oder Absturzberichts-Dienste von Drittanbietern.',
            'Kein Zugriff auf den Standort Ihres Geräts, auf Kontakte, Fotos, Kamera oder Mikrofon.',
            'Teilnehmende werden nur mit dem Nötigsten geführt: Name und optionale Angaben zur Teameinteilung, keine Kontaktdaten.',
            'Stationsgeräte brauchen kein persönliches Konto. Nur Organisatoren melden sich mit E-Mail und Passwort an.',
            'Daten werden nicht verkauft und nicht für Werbezwecke weitergegeben.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Verantwortlicher">
        {LEGAL_CONTROLLER ? (
          <LegalParagraph>{LEGAL_CONTROLLER}</LegalParagraph>
        ) : (
          <LegalParagraph>
            Die verantwortliche Stelle ist noch nicht hinterlegt (EXPO_PUBLIC_LEGAL_CONTROLLER).
          </LegalParagraph>
        )}
        {SUPPORT_EMAIL ? (
          <LegalParagraph>Kontakt für Datenschutzfragen: {SUPPORT_EMAIL}</LegalParagraph>
        ) : null}
        <LegalParagraph>
          Für die Inhalte einer einzelnen Veranstaltung (Teams, Betreuungspersonen, Ergebnisse)
          entscheidet die jeweilige Veranstaltungsleitung, die die Daten im Backoffice anlegt.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Welche Daten verarbeitet werden">
        <Text className="text-[15px] font-bold text-ink">Organisatoren (Backoffice)</Text>
        <LegalList
          items={[
            'E-Mail-Adresse und Passwort für die Anmeldung. Das Passwort wird vom Anmeldedienst nur als Hash gespeichert.',
            'Von Ihnen angelegte Veranstaltungsdaten: Name, Zeitraum, Teams, Spiele, Stationen mit festen Koordinaten, Zeitplan, Wertungsregeln, Hilfe-Rufnummern.',
            'Namen und Rollen von Betreuungspersonen, soweit Sie diese anlegen.',
            'Teilnehmende: Name, Teamzugehörigkeit und optional Geschlecht, Alter, Spielstärke (Skala 1–6) und eine Notiz, die zur Teameinteilung dienen (auch per CSV-Import). Die Angaben legt die Veranstaltungsleitung an; Teilnehmende selbst nutzen die App nicht.',
          ]}
        />
        <Text className="text-[15px] font-bold text-ink">Stationsgeräte</Text>
        <LegalList
          items={[
            'Beitritt über den gemeinsamen Veranstaltungscode mit einer anonymen Anmeldung. Dabei entsteht eine zufällige Geräte-ID, keine Verknüpfung zu einer Person.',
            'Die Auswahl, welche Betreuungsperson das Gerät bedient (nur der in der Betreuungsliste hinterlegte Name).',
            'Check-in und Check-out an Stationen mit Zeitpunkt, Spielergebnisse, Live-Zwischenstände, Ankunft und Weiterschicken von Gruppen sowie technische Synchronisierungsdaten (Planversion, letzter Kontakt, Zahl noch nicht übertragener Ergebnisse).',
          ]}
        />
        <Text className="text-[15px] font-bold text-ink">Auf dem Gerät gespeichert</Text>
        <LegalParagraph>
          Damit der Stationsbetrieb ohne Internet funktioniert, speichert die App das
          Veranstaltungspaket (Plan, Teams, Teilnehmernamen, Regeln, Offline-Karte, Rufnummern) und noch nicht
          übertragene Ergebnisse in einer lokalen Datenbank. Diese Daten verlassen das Gerät nur
          über die Synchronisierung mit der Veranstaltung. „Gerät zurücksetzen“ löscht sie.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Wofür und auf welcher Grundlage">
        <LegalParagraph>
          Die Daten dienen ausschließlich der Planung, Durchführung und Auswertung des jeweiligen
          Sporttags sowie dem sicheren Betrieb der App (Art. 6 Abs. 1 lit. b und f DSGVO). Es gibt
          kein Profiling und keine automatisierten Entscheidungen mit rechtlicher Wirkung.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Standort, Karte und Telefon">
        <LegalList
          items={[
            'Die App fragt den Standort Ihres Geräts nicht ab. Stationspins zeigen fest hinterlegte Koordinaten der Stationen, nicht Ihre Position.',
            'Die Offline-Karte ist ein vorab erzeugtes Bild. Beim Erstellen im Backoffice und bei der Online-Kartenansicht im Web werden Kartenkacheln von Esri (ArcGIS Online) geladen; dabei sieht der Anbieter technisch bedingt Ihre IP-Adresse. Die Adresssuche im Backoffice nutzt Nominatim (OpenStreetMap) und überträgt den eingegebenen Suchbegriff.',
            'Die Hilfe-Knöpfe „Assistenz“ und „Medizinisch“ öffnen die Telefon-App mit der konfigurierten Nummer. Die App überträgt dabei nichts und kann nicht feststellen, ob ein Gespräch zustande kam.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Empfänger und Auftragsverarbeiter">
        <LegalList
          items={[
            'Supabase: Datenbank, Anmeldung und Live-Aktualisierung der Veranstaltungsdaten.',
            'Vercel: Auslieferung der Web-Version dieser App.',
            'Apple und Google: Bereitstellung der App in den jeweiligen Stores nach deren eigenen Datenschutzbestimmungen.',
          ]}
        />
        <LegalParagraph>
          Mit diesen Dienstleistern bestehen bzw. werden Auftragsverarbeitungsverträge geschlossen.
          Sofern Daten in Länder außerhalb der EU übermittelt werden, geschieht dies auf Grundlage
          geeigneter Garantien (z. B. EU-Standardvertragsklauseln).
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Speicherdauer und Löschung">
        <LegalList
          items={[
            'Veranstaltungsdaten bleiben, bis die Veranstaltungsleitung sie löscht. Entwurfs-Veranstaltungen lassen sich im Backoffice löschen.',
            'Zugänge einzelner Geräte können im Backoffice widerrufen werden.',
            'Lokale Daten auf einem Stationsgerät löschen Sie über „Gerät zurücksetzen“ oder durch Deinstallation der App.',
            'Ein Organisatorenkonto kann auf Anfrage gelöscht werden (siehe Kontakt).',
          ]}
        />
      </LegalSection>

      <LegalSection title="Ihre Rechte">
        <LegalParagraph>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
          Verarbeitung, Datenübertragbarkeit und Widerspruch. Außerdem können Sie sich bei einer
          Datenschutz-Aufsichtsbehörde beschweren. Wenden Sie sich für Anfragen an die
          Veranstaltungsleitung oder an den oben genannten Verantwortlichen.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Kinder und Jugendliche">
        <LegalParagraph>
          Die App richtet sich an Betreuende und Organisatoren, nicht an Kinder. Teilnehmende, oft
          Minderjährige, werden von der Veranstaltungsleitung erfasst. Legen Sie nur Daten an, die
          für die Teameinteilung nötig sind, und holen Sie die erforderlichen Einwilligungen der
          Sorgeberechtigten bzw. Anmeldungsgrundlagen ein. Notizen bitte ohne Gesundheitsdaten
          halten. Stationsgeräte erhalten die Teilnehmernamen im Offline-Paket.
        </LegalParagraph>
      </LegalSection>

      <LegalSection title="Änderungen">
        <LegalParagraph>
          Wir passen diese Erklärung an, wenn sich die App oder die Rechtslage ändert. Das Datum
          oben zeigt den aktuellen Stand.
        </LegalParagraph>
      </LegalSection>

      <Button
        label="Support & Feedback"
        leftIcon="headset"
        onPress={() => router.push('/support')}
        variant="outline"
      />
    </Screen>
  );
}
