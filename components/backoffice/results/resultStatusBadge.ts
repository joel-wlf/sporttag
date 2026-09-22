import type { BadgeTone } from '@/components/ui/Badge';
import type { ResultStatus } from '@/lib/results/derive';

/** Statusfarbe als Badge-Ton, analog zu components/backoffice/live/liveStatusColor.ts. */
export const resultBadgeTone: Record<ResultStatus, BadgeTone> = {
  open: 'neutral',
  accepted: 'success',
  corrected: 'accent',
  needs_review: 'warning',
  conflict: 'danger',
  cancelled: 'neutral',
};
