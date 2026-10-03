/**
 * Lade-Hooks für `npm test`: löst den Projektalias `@/` auf, ergänzt
 * Dateiendungen und ersetzt native Module durch Node-Stubs. expo-sqlite läuft
 * über node:sqlite, damit der echte lokale Speicher (lib/station/store.ts)
 * mit echtem SQL geprüft wird.
 */
const ROOT = new URL('../../', import.meta.url).href;
const STUBS = new URL('./stubs/', import.meta.url).href;
const STUBBED = {
  'expo-sqlite': 'sqlite.mjs',
  'react-native': 'native.mjs',
  'expo-crypto': 'native.mjs',
  'expo-file-system': 'native.mjs',
  '@react-native-async-storage/async-storage': 'native.mjs',
  '@/lib/supabase': 'native.mjs',
};

export async function resolve(specifier, context, next) {
  if (STUBBED[specifier]) return { url: STUBS + STUBBED[specifier], shortCircuit: true };
  const spec = specifier.startsWith('@/') ? ROOT + specifier.slice(2) : specifier;
  try {
    return await next(spec, context);
  } catch (error) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      try {
        return await next(spec + ext, context);
      } catch {
        // nächste Endung
      }
    }
    throw error;
  }
}
