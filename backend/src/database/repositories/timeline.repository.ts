import { PALESTINE_TIMELINE } from '../seed/palestine-data';
import { TimelineEvent } from '../entities/timeline-event.entity';
import { DatabaseService } from '../database.service';
import { SEED_TIMELINE } from '../seed/generated-data';
import { countBy } from './count-by';

export interface TimelineRepository {
  findByLocation(locationId: string): Promise<TimelineEvent[]>;
  /** Event count per location id, for the summary shown on location cards. */
  countsByLocation(): Promise<Record<string, number>>;
}

interface TimelineRow {
  id: string;
  location_id: string;
  period_label: string;
  description: string;
  sort_year: number;
  sort_order: number;
  is_tradition: boolean;
  source_file: string | null;
}

function toEvent(row: TimelineRow): TimelineEvent {
  return {
    id: row.id,
    locationId: row.location_id,
    periodLabel: row.period_label,
    description: row.description,
    sortYear: row.sort_year,
    sortOrder: row.sort_order,
    isTradition: row.is_tradition,
    sourceFile: row.source_file ?? undefined,
  };
}

export class PostgresTimelineRepository implements TimelineRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByLocation(locationId: string): Promise<TimelineEvent[]> {
    const result = await this.db.query<TimelineRow>(
      'SELECT * FROM timeline_events WHERE location_id = $1 ORDER BY sort_order',
      [locationId],
    );
    return result.rows.map(toEvent);
  }

  async countsByLocation(): Promise<Record<string, number>> {
    const result = await this.db.query<{ location_id: string; count: string }>(
      'SELECT location_id, COUNT(*)::text AS count FROM timeline_events GROUP BY location_id',
    );
    return Object.fromEntries(
      result.rows.map((row) => [row.location_id, Number(row.count)]),
    );
  }
}

/** Serves database/seed-generated.sql from memory when PostgreSQL is absent. */
export class InMemoryTimelineRepository implements TimelineRepository {
  private readonly events: TimelineEvent[] = [
    ...SEED_TIMELINE,
    ...PALESTINE_TIMELINE,
  ].map((event) => ({
    ...event,
  }));

  findByLocation(locationId: string): Promise<TimelineEvent[]> {
    return Promise.resolve(
      this.events
        .filter((event) => event.locationId === locationId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  countsByLocation(): Promise<Record<string, number>> {
    return Promise.resolve(countBy(this.events, (event) => event.locationId));
  }
}
