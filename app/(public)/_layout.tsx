import { Stack } from 'expo-router';

// Öffentlich erreichbar ohne Anmeldung und ohne Veranstaltungscode: Apple und
// Google verlangen eine Datenschutz- und eine Support-URL, die ohne Login
// funktioniert (/privacy, /support). Die Routenwache lässt diese Gruppe durch.
export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
