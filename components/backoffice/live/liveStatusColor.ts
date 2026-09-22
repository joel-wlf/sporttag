import type { ThemeTokens } from '@/components/ui/theme';
import type { LiveStatus, LiveTone } from '@/lib/live/derive';
import { liveStatusTone } from '@/lib/live/derive';

export function toneColor(tokens: ThemeTokens, tone: LiveTone): string {
  if (tone === 'subtle') return tokens.subtle;
  return tokens[tone];
}

export function statusColor(tokens: ThemeTokens, status: LiveStatus): string {
  return toneColor(tokens, liveStatusTone[status]);
}
