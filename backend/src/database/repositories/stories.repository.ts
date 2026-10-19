import { PALESTINE_STORIES } from '../seed/palestine-data';
import { randomUUID } from 'crypto';
import { Story, StoryStatus } from '../entities/story.entity';
import { DatabaseService } from '../database.service';
import { SEED_STORIES } from '../seed/seed-data';

export type NewStory = Omit<Story, 'id' | 'createdAt' | 'updatedAt'>;

/** Per-location totals used for the summary shown on location cards. */
export interface StoryStats {
  count: number;
  words: number;
}

export interface StoriesRepository {
  /** Published stories for a location, newest first. */
  findByLocation(locationId: string): Promise<Story[]>;
  findById(id: string): Promise<Story | null>;
  create(story: NewStory): Promise<Story>;
  /** Every published story, used to pick the story of the day and a random one. */
  findAllPublished(): Promise<Story[]>;
  statsByLocation(): Promise<Record<string, StoryStats>>;
}

interface StoryRow {
  id: string;
  location_id: string;
  author_id: string | null;
  title: string;
  summary: string | null;
  original_content: string | null;
  simplified_story: string;
  audience: string;
  language: string;
  tone: string;
  source: string | null;
  is_ai_generated: boolean;
  uncertainty_notes: string[] | null;
  status: StoryStatus;
  created_at: Date;
  updated_at: Date;
}

function toStory(row: StoryRow): Story {
  return {
    id: row.id,
    locationId: row.location_id,
    authorId: row.author_id,
    title: row.title,
    summary: row.summary ?? undefined,
    originalContent: row.original_content ?? undefined,
    simplifiedStory: row.simplified_story,
    audience: row.audience,
    language: row.language,
    tone: row.tone,
    source: row.source ?? undefined,
    isAiGenerated: row.is_ai_generated,
    uncertaintyNotes: row.uncertainty_notes ?? [],
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresStoriesRepository implements StoriesRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByLocation(locationId: string): Promise<Story[]> {
    const result = await this.db.query<StoryRow>(
      `SELECT * FROM stories
       WHERE location_id = $1 AND status = 'published'
       ORDER BY created_at DESC`,
      [locationId],
    );
    return result.rows.map(toStory);
  }

  async findById(id: string): Promise<Story | null> {
    const result = await this.db.query<StoryRow>(
      'SELECT * FROM stories WHERE id = $1',
      [id],
    );
    return result.rows.length ? toStory(result.rows[0]) : null;
  }

  async findAllPublished(): Promise<Story[]> {
    const result = await this.db.query<StoryRow>(
      `SELECT * FROM stories WHERE status = 'published'
       ORDER BY location_id, created_at DESC`,
    );
    return result.rows.map(toStory);
  }

  async statsByLocation(): Promise<Record<string, StoryStats>> {
    // array_length over a whitespace split is the same word count the
    // in-memory repository computes, so reading times agree across backends.
    const result = await this.db.query<{
      location_id: string;
      count: string;
      words: string;
    }>(
      `SELECT location_id,
              COUNT(*)::text AS count,
              COALESCE(SUM(array_length(regexp_split_to_array(trim(simplified_story), '\\s+'), 1)), 0)::text AS words
       FROM stories
       WHERE status = 'published'
       GROUP BY location_id`,
    );
    return Object.fromEntries(
      result.rows.map((row) => [
        row.location_id,
        { count: Number(row.count), words: Number(row.words) },
      ]),
    );
  }

  async create(story: NewStory): Promise<Story> {
    const result = await this.db.query<StoryRow>(
      `INSERT INTO stories
         (location_id, author_id, title, summary, original_content, simplified_story,
          audience, language, tone, source, is_ai_generated, uncertainty_notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        story.locationId,
        story.authorId ?? null,
        story.title,
        story.summary ?? null,
        story.originalContent ?? null,
        story.simplifiedStory,
        story.audience,
        story.language,
        story.tone,
        story.source ?? null,
        story.isAiGenerated,
        story.uncertaintyNotes,
        story.status,
      ],
    );
    return toStory(result.rows[0]);
  }
}

/** Serves database/seed.sql from memory when PostgreSQL is not configured. */
export class InMemoryStoriesRepository implements StoriesRepository {
  private readonly stories: Story[] = [
    ...SEED_STORIES,
    ...PALESTINE_STORIES,
  ].map((story) => ({
    ...story,
    uncertaintyNotes: [...story.uncertaintyNotes],
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  findByLocation(locationId: string): Promise<Story[]> {
    return Promise.resolve(
      this.stories.filter(
        (story) =>
          story.locationId === locationId && story.status === 'published',
      ),
    );
  }

  findById(id: string): Promise<Story | null> {
    return Promise.resolve(
      this.stories.find((story) => story.id === id) ?? null,
    );
  }

  findAllPublished(): Promise<Story[]> {
    return Promise.resolve(
      this.stories.filter((story) => story.status === 'published'),
    );
  }

  statsByLocation(): Promise<Record<string, StoryStats>> {
    const stats: Record<string, StoryStats> = {};
    for (const story of this.stories) {
      if (story.status !== 'published') continue;
      const entry = stats[story.locationId] ?? { count: 0, words: 0 };
      entry.count += 1;
      entry.words += story.simplifiedStory
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      stats[story.locationId] = entry;
    }
    return Promise.resolve(stats);
  }

  create(story: NewStory): Promise<Story> {
    const created: Story = {
      ...story,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.stories.unshift(created);
    return Promise.resolve(created);
  }
}
