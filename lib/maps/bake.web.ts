import type { Bounds } from '@/components/map/types';
import { ESRI_IMAGERY_TILE_URL, TILE_ATTRIBUTION } from '@/components/map/mapStyle';
import type { BakedMap } from './bake';
import { planBake, TILE_SIZE } from './tiles';

export type { BakedMap };

export const canBakeMap = true;

const CONCURRENCY = 6;
const RETRIES = 2;

async function loadTile(url: string): Promise<ImageBitmap> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Kachel ${response.status}`);
      return await createImageBitmap(await response.blob());
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Kachel konnte nicht geladen werden.');
}

async function sha256Hex(blob: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Setzt die Satellitenkacheln des Geländes (mit Rand) zu einem einzigen,
 * an den Kachelrand ausgerichteten Web-Mercator-Bild zusammen. Ein
 * unvollständiges Bild wird nie zurückgegeben: fehlt eine Kachel, schlägt
 * das ganze Backen fehl.
 */
export async function bakeMapImage(
  venue: Bounds,
  onProgress?: (done: number, total: number) => void,
): Promise<BakedMap> {
  const plan = planBake(venue);
  const canvas = document.createElement('canvas');
  canvas.width = plan.widthPx;
  canvas.height = plan.heightPx;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Zeichenfläche nicht verfügbar.');

  const jobs: { x: number; y: number }[] = [];
  for (let y = plan.y0; y <= plan.y1; y++) for (let x = plan.x0; x <= plan.x1; x++) jobs.push({ x, y });

  let done = 0;
  onProgress?.(0, jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const url = ESRI_IMAGERY_TILE_URL.replace('{z}', String(plan.zoom))
        .replace('{y}', String(job.y))
        .replace('{x}', String(job.x));
      const bitmap = await loadTile(url);
      context.drawImage(bitmap, (job.x - plan.x0) * TILE_SIZE, (job.y - plan.y0) * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      bitmap.close();
      onProgress?.(++done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden.'))), 'image/jpeg', 0.85),
  );
  return {
    blob,
    mimeType: 'image/jpeg',
    hash: await sha256Hex(blob),
    widthPx: plan.widthPx,
    heightPx: plan.heightPx,
    bounds: plan.bounds,
    zoom: plan.zoom,
    sourceLabel: `Esri World Imagery, Zoom ${plan.zoom}`,
    attribution: TILE_ATTRIBUTION,
  };
}
