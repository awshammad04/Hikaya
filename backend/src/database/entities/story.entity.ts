/**
 * A narrative attached to a location, mirroring the `stories` table in
 * database/schema.sql. Covers both editor-written and AI-generated stories.
 */
export type StoryStatus = 'draft' | 'pending_review' | 'published' | 'rejected';

export class Story {
  id: string;
  locationId: string;
  authorId?: string | null;
  title: string;
  summary?: string;
  /** The reviewed source the story was built from. */
  originalContent?: string;
  /** The narrative shown to the user. */
  simplifiedStory: string;
  audience: string;
  language: string;
  tone: string;
  source?: string;
  isAiGenerated: boolean;
  /** Gaps the AI flagged rather than inventing. Stored for reviewers. */
  uncertaintyNotes: string[];
  status: StoryStatus;
  createdAt?: Date;
  updatedAt?: Date;
}
