/**
 * A recorded testimony and its machine transcript, mirroring the `story_audio`
 * table in database/migrations/003-story-audio.sql. Like contributions, every
 * recording starts as `pending_review` and is never served until approved.
 */
export type StoryAudioStatus = 'pending_review' | 'approved' | 'rejected';

export class StoryAudio {
  id: string;
  referenceCode: string;
  locationId?: string | null;
  /** Private storage key relative to the voice upload directory. */
  audioPath: string;
  originalFilename: string;
  mimeType: string;
  transcript: string;
  language: string;
  consentGivenAt: Date;
  status: StoryAudioStatus;
  reviewNotes?: string | null;
  reviewedAt?: Date | null;
  submittedAt: Date;
}
