import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Text } from 'react-native';
import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { LegalList, LegalParagraph, LegalSection } from '@/components/legal/LegalBlocks';
import { Button } from '@/components/ui/Button';
import { SUPPORT_EMAIL } from '@/lib/legal';

type Topic = { id: string; label: string; subject: string; hint: string };

const topics: Topic[] = [
  {
    id: 'feedback',
    label: 'Feedback geben',
    subject: 'Feedback zu Sporttag',
    hint: 'Was funktioniert gut, was fehlt, was würden Sie ändern?',
  },
  {
    id: 'bug',
    label: 'Fehler melden',
    subject: 'Fehler in Sporttag',
    hint: 'Was haben Sie getan, was ist passiert, was haben Sie erwartet? War das Gerät online oder offline?',
  },
  {
    id: 'privacy',
    label: 'Datenschutzanfrage',
    subject: 'Datenschutzanfrage Sporttag',
    hint: 'Auskunft, Berichtigung oder Löschung: Bitte nennen Sie Veranstaltung und Konto-E-Mail.',
  },
];

function buildMailto(topic: Topic) {
  const info = [
    `App-Version: ${Constants.expoConfig?.version ?? 'unbekannt'}`,
    `Plattform: ${Platform.OS} ${String(Platform.Version)}`,
  ].join('\n');
  const body = `${topic.hint}\n\n\n---\n${info}\n(Bitte keine Passwörter oder Veranstaltungscodes senden.)`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(topic.subject)}&body=${encodeURIComponent(body)}`;
}

export default function SupportScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const open = async (topic: Topic) => {
    setError(null);
    try {
      await Linking.openURL(buildMailto(topic));
    } catch {
      // Kein Mailprogramm: nie so tun, als wäre die Nachricht unterwegs.
      setError(`Es konnte kein Mailprogramm geöffnet werden. Schreiben Sie bitte direkt an ${SUPPORT_EMAIL}.`);
    }
  };

  return (
    <Screen size="narrow">
      <Header
        description="Fragen, Fehler oder Ideen zur Sporttag-App? Schreiben Sie uns."
        eyebrow="HILFE"
        onBack={router.canGoBack() ? () => router.back() : undefined}
        title="Support & Feedback"
      />

      <LegalSection
        intro="Die Nachricht wird in Ihrem Mailprogramm vorbereitet und erst gesendet, wenn Sie sie dort absenden. Die App überträgt selbst nichts."
        title="Kontakt aufnehmen"
      >
        {SUPPORT_EMAIL ? (
          <>
            {topics.map((topic, index) => (
              <Button
                fullWidth
                key={topic.id}
                label={topic.label}
                leftIcon={topic.id === 'privacy' ? 'shield' : 'headset'}
                onPress={() => void open(topic)}
                variant={index === 0 ? 'primary' : 'outline'}
              />
            ))}
            <LegalParagraph>Oder direkt per E-Mail: {SUPPORT_EMAIL}</LegalParagraph>
            {error ? (
              <Text accessibilityRole="alert" className="text-sm font-semibold text-danger">
                {error}
              </Text>
            ) : null}
          </>
        ) : (
          <LegalParagraph>
            Die Support-Adresse ist noch nicht hinterlegt (EXPO_PUBLIC_SUPPORT_EMAIL).
          </LegalParagraph>
        )}
      </LegalSection>

      <LegalSection title="Schnelle Hilfe am Sporttag">
        <LegalList
          items={[
            'Veranstaltungscode unbekannt oder abgelehnt: Die Veranstaltungsleitung gibt ihn im Backoffice aus und kann ihn neu erzeugen.',
            'Ergebnis nicht übertragen: Auf dem Sync-Bildschirm zeigt die App, was lokal gesichert, angenommen oder zu klären ist. Ergebnisse bleiben auf dem Gerät, bis sie bestätigt sind.',
            'Hilfe im Notfall: Die Knöpfe „Assistenz“ und „Medizinisch“ rufen die von der Veranstaltungsleitung hinterlegten Nummern an. Im Notfall zusätzlich den Notruf 112 wählen.',
          ]}
        />
      </LegalSection>

      <Button
        label="Datenschutzerklärung"
        leftIcon="shield"
        onPress={() => router.push('/privacy')}
        variant="outline"
      />
    </Screen>
  );
}
