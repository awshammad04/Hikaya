import { Location } from '../entities/location.entity';
import { DatabaseService } from '../database.service';
import { SEED_LOCATIONS } from '../seed/seed-data';
import { PALESTINE_LOCATIONS } from '../seed/palestine-data';

export interface LocationsRepository {
  findAll(): Promise<Location[]>;
  findById(id: string): Promise<Location | null>;
}

interface LocationRow {
  id: string;
  governorate_id?: string;
  arabic_description?: string;
  review_status?: string;
  coordinate_status?: string;
  name: string;
  arabic_name: string | null;
  city: string | null;
  country: string;
  latitude: string | null;
  longitude: string | null;
  description: string | null;
  cover_image_url: string | null;
  content_file: string | null;
  ai_summary_file: string | null;
  is_published: boolean;
  categories: string[] | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * `latitude`/`longitude` are NUMERIC columns, which node-postgres returns as
 * strings to avoid silent precision loss. The API contract is numbers, so they
 * are converted here rather than in every caller.
 */
function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    governorateId: row.governorate_id ?? 'jerusalem',
    arabicDescription: row.arabic_description,
    reviewStatus: row.review_status,
    coordinateStatus: row.coordinate_status,
    name: row.name,
    arabicName: row.arabic_name ?? undefined,
    city: row.city ?? undefined,
    country: row.country,
    latitude: row.latitude === null ? undefined : Number(row.latitude),
    longitude: row.longitude === null ? undefined : Number(row.longitude),
    description: row.description ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    contentFile: row.content_file ?? undefined,
    aiSummaryFile: row.ai_summary_file ?? undefined,
    categories: row.categories ?? [],
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_LOCATIONS = `
  SELECT l.*,
         COALESCE(
           ARRAY_AGG(c.name ORDER BY c.name) FILTER (WHERE c.name IS NOT NULL),
           '{}'
         ) AS categories
  FROM locations l
  LEFT JOIN location_categories lc ON lc.location_id = l.id
  LEFT JOIN categories c ON c.id = lc.category_id
  WHERE l.is_published = TRUE
`;

export class PostgresLocationsRepository implements LocationsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(): Promise<Location[]> {
    const result = await this.db.query<LocationRow>(
      `${SELECT_LOCATIONS} GROUP BY l.id ORDER BY l.name`,
    );
    return result.rows.map(toLocation);
  }

  async findById(id: string): Promise<Location | null> {
    const result = await this.db.query<LocationRow>(
      `${SELECT_LOCATIONS} AND l.id = $1 GROUP BY l.id`,
      [id],
    );
    return result.rows.length ? toLocation(result.rows[0]) : null;
  }
}

/** Serves database/seed.sql from memory when PostgreSQL is not configured. */
export class InMemoryLocationsRepository implements LocationsRepository {
  private readonly locations: Location[] = [
    ...SEED_LOCATIONS,
    ...PALESTINE_LOCATIONS,
  ].map((location) => ({
    ...location,
    governorateId: location.governorateId ?? 'jerusalem',
    categories: [...location.categories],
  }));

  findAll(): Promise<Location[]> {
    return Promise.resolve(
      this.locations
        .filter((location) => location.isPublished)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
  }

  findById(id: string): Promise<Location | null> {
    const found = this.locations.find(
      (location) => location.id === id && location.isPublished,
    );
    return Promise.resolve(found ?? null);
  }
}
