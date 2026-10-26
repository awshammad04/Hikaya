/**
 * Visitor accounts and the personal data attached to them, mirroring
 * database/migrations/003-accounts.sql.
 *
 * Accounts are optional. A guest keeps the same data in the browser; signing
 * up or logging in merges it into these tables.
 */
export type UserRole = 'visitor' | 'contributor' | 'editor' | 'admin';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

/** Internal only: never returned by a controller. */
export interface UserWithSecret extends User {
  passwordHash: string | null;
}

export type ProgressKind = 'visited' | 'quiz' | 'audio' | 'memory_uncovered';
export const PROGRESS_KINDS: ProgressKind[] = [
  'visited',
  'quiz',
  'audio',
  'memory_uncovered',
];

export type Progress = Record<ProgressKind, string[]>;

export interface UserPhoto {
  id: string;
  userId: string;
  governorateId: string | null;
  governorateIds: string[];
  locationTag: string;
  note: string;
  photoMime: string;
  createdAt: Date;
}

export interface UserPhotoImage {
  photo: Buffer;
  photoMime: string;
}

/** `my_story` is one the visitor wrote; it stays private unless they share it. */
export type SavedStoryKind = 'journey' | 'location_story' | 'my_story';

export interface SavedStory {
  id: string;
  userId: string;
  kind: SavedStoryKind;
  title: string;
  locationId: string | null;
  governorateIds: string[];
  payload: unknown;
  createdAt: Date;
}
