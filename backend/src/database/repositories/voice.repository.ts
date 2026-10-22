import { randomUUID } from 'crypto';
import { StoryAudio, StoryAudioStatus } from '../entities/story-audio.entity';
import { DatabaseService } from '../database.service';

export type NewStoryAudio = Omit<
  StoryAudio,
  'id' | 'submittedAt' | 'reviewedAt' | 'reviewNotes'
>;

export interface VoiceRepository {
  create(audio: NewStoryAudio): Promise<StoryAudio>;
  /** The contributor asking about their own recording, whatever its status. */
  findByReference(referenceCode: string): Promise<StoryAudio | null>;
}

interface StoryAudioRow {
  id: string;
  reference_code: string;
  location_id: string | null;
  audio_path: string;
  original_filename: string;
  mime_type: string;
  transcript: string;
  language: string;
  consent_given_at: Date;
  status: StoryAudioStatus;
  review_notes: string | null;
  reviewed_at: Date | null;
  submitted_at: Date;
}

function toStoryAudio(row: StoryAudioRow): StoryAudio {
  return {
    id: row.id,
    referenceCode: row.reference_code,
    locationId: row.location_id,
    audioPath: row.audio_path,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    transcript: row.transcript,
    language: row.language,
    consentGivenAt: row.consent_given_at,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    submittedAt: row.submitted_at,
  };
}

export class PostgresVoiceRepository implements VoiceRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(audio: NewStoryAudio): Promise<StoryAudio> {
    const result = await this.db.query<StoryAudioRow>(
      `INSERT INTO story_audio
         (reference_code, location_id, audio_path, original_filename,
          mime_type, transcript, language, consent_given_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        audio.referenceCode,
        audio.locationId ?? null,
        audio.audioPath,
        audio.originalFilename,
        audio.mimeType,
        audio.transcript,
        audio.language,
        audio.consentGivenAt,
        audio.status,
      ],
    );
    return toStoryAudio(result.rows[0]);
  }

  async findByReference(referenceCode: string): Promise<StoryAudio | null> {
    const result = await this.db.query<StoryAudioRow>(
      'SELECT * FROM story_audio WHERE reference_code = $1',
      [referenceCode],
    );
    return result.rows.length ? toStoryAudio(result.rows[0]) : null;
  }
}

/** Process-lifetime store used when PostgreSQL is not configured (dev/demo). */
export class InMemoryVoiceRepository implements VoiceRepository {
  private readonly items: StoryAudio[] = [];

  create(audio: NewStoryAudio): Promise<StoryAudio> {
    const created: StoryAudio = {
      ...audio,
      id: randomUUID(),
      reviewNotes: null,
      reviewedAt: null,
      submittedAt: new Date(),
    };
    this.items.unshift(created);
    return Promise.resolve(created);
  }

  findByReference(referenceCode: string): Promise<StoryAudio | null> {
    return Promise.resolve(
      this.items.find((item) => item.referenceCode === referenceCode) ?? null,
    );
  }
}
