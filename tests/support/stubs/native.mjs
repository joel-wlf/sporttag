// Minimale Stubs für native Module; nur was die geprüften Funktionen brauchen.
import { createHash, randomUUID as nodeRandomUUID } from 'node:crypto';

export const Linking = {
  opened: [],
  async openURL(url) {
    Linking.opened.push(url);
  },
};
export const Platform = { OS: 'ios' };
export const AppState = { addEventListener: () => ({ remove() {} }) };
export const supabase = {};
export const randomUUID = () => nodeRandomUUID();
export const CryptoDigestAlgorithm = { SHA256: 'SHA256' };
export async function digestStringAsync(_algorithm, input) {
  return createHash('sha256').update(input).digest('hex');
}
export class Directory {}
export class File {}
export const Paths = {};
export default {};
