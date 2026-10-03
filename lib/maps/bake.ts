import type { Bounds } from '@/components/map/types';

export type BakedMap = {
  blob: Blob;
  mimeType: string;
  hash: string;
  widthPx: number;
  heightPx: number;
  bounds: Bounds;
  zoom: number;
  sourceLabel: string;
  attribution: string;
};

export const canBakeMap = false;

export async function bakeMapImage(
  _venue: Bounds,
  _onProgress?: (done: number, total: number) => void,
): Promise<BakedMap> {
  throw new Error('Das Kartenbild wird im Web-Backoffice erstellt.');
}
