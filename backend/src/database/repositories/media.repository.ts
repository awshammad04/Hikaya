import { MediaItem } from '../entities/media.entity';
import { DatabaseService } from '../database.service';
import { SEED_MEDIA } from '../seed/generated-data';
import { countBy } from './count-by';

export interface BeforeAfterPair {
  before: MediaItem;
  after: MediaItem;
}

export interface MediaRepository {
  findByLocation(locationId: string): Promise<MediaItem[]>;
  /** The two halves of a historical comparison, when the location has both. */
  findPair(locationId: string): Promise<BeforeAfterPair | null>;
  /** Image count per location id, for the summary shown on location cards. */
  countsByLocation(): Promise<Record<string, number>>;
}

interface MediaRow {
  id: string;
  location_id: string;
  type: MediaItem['type'];
  url: string;
  thumb_url: string | null;
  width: number | null;
  height: number | null;
  subject: string | null;
  subject_ar: string | null;
  description: string | null;
  description_ar: string | null;
  era: MediaItem['era'];
  pair_role: MediaItem['pairRole'] | null;
  credit: string | null;
  license: string | null;
  license_url: string | null;
  captured_at: string | null;
  source_url: string | null;
  sort_order: number;
}

function toMedia(row: MediaRow): MediaItem {
  return {
    id: row.id,
    locationId: row.location_id,
    type: row.type,
    url: row.url,
    thumbUrl: row.thumb_url ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    subject: row.subject ?? undefined,
    arabicSubject: row.subject_ar ?? undefined,
    description: row.description ?? undefined,
    arabicDescription: row.description_ar ?? undefined,
    era: row.era,
    pairRole: row.pair_role ?? undefined,
    credit: row.credit ?? undefined,
    license: row.license ?? undefined,
    licenseUrl: row.license_url ?? undefined,
    capturedAt: row.captured_at ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sortOrder: row.sort_order,
  };
}

/**
 * A before/after comparison only makes sense when both halves show the same
 * subject. Locations without a matching historical photograph get no pair, and
 * the UI says so rather than pairing two unrelated images.
 */
function pairFrom(items: MediaItem[]): BeforeAfterPair | null {
  const before = items.find((item) => item.pairRole === 'before');
  const after = items.find((item) => item.pairRole === 'after');
  if (!before || !after || before.subject !== after.subject) {
    return null;
  }
  return { before, after };
}

export class PostgresMediaRepository implements MediaRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByLocation(locationId: string): Promise<MediaItem[]> {
    const result = await this.db.query<MediaRow>(
      `SELECT * FROM media
       WHERE location_id = $1 AND type = 'image'
       ORDER BY sort_order`,
      [locationId],
    );
    return result.rows.map(toMedia);
  }

  async findPair(locationId: string): Promise<BeforeAfterPair | null> {
    return pairFrom(await this.findByLocation(locationId));
  }

  async countsByLocation(): Promise<Record<string, number>> {
    const result = await this.db.query<{ location_id: string; count: string }>(
      `SELECT location_id, COUNT(*)::text AS count FROM media
       WHERE type = 'image' GROUP BY location_id`,
    );
    return Object.fromEntries(
      result.rows.map((row) => [row.location_id, Number(row.count)]),
    );
  }
}

/** Serves database/seed-generated.sql from memory when PostgreSQL is absent. */
export class InMemoryMediaRepository implements MediaRepository {
  private readonly media: MediaItem[] = SEED_MEDIA.map((item) => ({ ...item }));

  findByLocation(locationId: string): Promise<MediaItem[]> {
    return Promise.resolve(
      this.media
        .filter(
          (item) => item.locationId === locationId && item.type === 'image',
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  async findPair(locationId: string): Promise<BeforeAfterPair | null> {
    return pairFrom(await this.findByLocation(locationId));
  }

  countsByLocation(): Promise<Record<string, number>> {
    return Promise.resolve(
      countBy(
        this.media.filter((item) => item.type === 'image'),
        (item) => item.locationId,
      ),
    );
  }
}
