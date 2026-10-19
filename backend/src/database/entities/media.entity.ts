/**
 * Media metadata, mirroring the `media` table in database/schema.sql.
 *
 * Hikaya stores no media files: `url` points at an external host, and `credit`
 * plus `license` travel with it so the gallery can display attribution next to
 * every image. An item without both is not publishable.
 */
export type MediaEra = 'modern' | 'historical';
export type MediaPairRole = 'cover' | 'before' | 'after';

export class MediaItem {
  id: string;
  locationId: string;
  type: 'image' | 'audio' | 'video' | 'document';
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  /** The landmark shown, e.g. 'Damascus Gate'. */
  subject?: string;
  /** Arabic visitor-facing landmark name, stored with the canonical record. */
  arabicSubject?: string;
  description?: string;
  /** Arabic visitor-facing educational caption. */
  arabicDescription?: string;
  era: MediaEra;
  /** Marks the cover photo, or the two halves of a before/after comparison. */
  pairRole?: MediaPairRole;
  credit?: string;
  license?: string;
  licenseUrl?: string;
  /** Free text - sources give ranges like 'between 1934 and 1939'. */
  capturedAt?: string;
  sourceUrl?: string;
  sortOrder: number;
}
