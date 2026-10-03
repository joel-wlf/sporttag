import type { TeamRunsheet } from '@/lib/schedule/runsheet';

export const canExportRunsheets = false;

export async function exportRunsheets(_runsheets: TeamRunsheet[], _fileBase: string): Promise<void> {
  throw new Error('Der Laufzettel-Export ist im Web-Backoffice verfügbar.');
}
