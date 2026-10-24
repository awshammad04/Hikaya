import { randomUUID } from 'crypto';
import {
  PROGRESS_KINDS,
  Progress,
  ProgressKind,
  SavedStory,
  User,
  UserPhoto,
  UserPhotoImage,
  UserWithSecret,
} from '../entities/account.entity';
import { DatabaseService } from '../database.service';

export type NewUser = Pick<
  UserWithSecret,
  'fullName' | 'email' | 'passwordHash'
>;
export type NewPhoto = Omit<UserPhoto, 'createdAt'> &
  UserPhotoImage & { createdAt?: Date };
export type NewSavedStory = Omit<SavedStory, 'createdAt'> & {
  createdAt?: Date;
};

export interface AccountsRepository {
  createUser(user: NewUser): Promise<User>;
  findUserByEmail(email: string): Promise<UserWithSecret | null>;
  findUserById(id: string): Promise<UserWithSecret | null>;
  deleteUser(id: string): Promise<void>;
  touchLogin(id: string): Promise<void>;

  createSession(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void>;
  /** The session's user, or null when the session is unknown or expired. */
  findSessionUser(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;

  getProgress(userId: string): Promise<Progress>;
  /** Adds items (duplicates are ignored) and returns the merged progress. */
  addProgress(userId: string, items: Partial<Progress>): Promise<Progress>;
  removeProgress(
    userId: string,
    kind: ProgressKind,
    ids: string[],
  ): Promise<Progress>;

  listPhotos(userId: string): Promise<UserPhoto[]>;
  /** Idempotent on id: re-uploading the same photo keeps the first copy. */
  addPhoto(photo: NewPhoto): Promise<UserPhoto>;
  findPhotoImage(userId: string, id: string): Promise<UserPhotoImage | null>;
  deletePhoto(userId: string, id: string): Promise<boolean>;

  listStories(userId: string): Promise<SavedStory[]>;
  /** Idempotent on id, like addPhoto. */
  addStory(story: NewSavedStory): Promise<SavedStory>;
  deleteStory(userId: string, id: string): Promise<boolean>;
}

function emptyProgress(): Progress {
  return { visited: [], quiz: [], audio: [], memory_uncovered: [] };
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: User['role'];
  password_hash: string | null;
  created_at: Date;
}

function toUser(row: UserRow): UserWithSecret {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export function publicUser(user: UserWithSecret): User {
  const copy: Partial<UserWithSecret> = { ...user };
  delete copy.passwordHash;
  return copy as User;
}

function photoMeta(stored: UserPhoto & UserPhotoImage): UserPhoto {
  const copy: Partial<UserPhoto & UserPhotoImage> = { ...stored };
  delete copy.photo;
  return copy as UserPhoto;
}

interface PhotoRow {
  id: string;
  user_id: string;
  governorate_id: string | null;
  governorate_ids: string[];
  location_tag: string;
  note: string;
  photo_mime: string;
  created_at: Date;
}

function toPhoto(row: PhotoRow): UserPhoto {
  return {
    id: row.id,
    userId: row.user_id,
    governorateId: row.governorate_id,
    governorateIds: row.governorate_ids ?? [],
    locationTag: row.location_tag,
    note: row.note,
    photoMime: row.photo_mime,
    createdAt: row.created_at,
  };
}

interface StoryRow {
  id: string;
  user_id: string;
  kind: SavedStory['kind'];
  title: string;
  location_id: string | null;
  governorate_ids: string[];
  payload: unknown;
  created_at: Date;
}

function toStory(row: StoryRow): SavedStory {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    locationId: row.location_id,
    governorateIds: row.governorate_ids ?? [],
    payload: row.payload,
    createdAt: row.created_at,
  };
}

const PHOTO_COLUMNS =
  'id, user_id, governorate_id, governorate_ids, location_tag, note, photo_mime, created_at';

export class PostgresAccountsRepository implements AccountsRepository {
  constructor(private readonly db: DatabaseService) {}

  async createUser(user: NewUser): Promise<User> {
    const result = await this.db.query<UserRow>(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3) RETURNING *`,
      [user.fullName, user.email, user.passwordHash],
    );
    return publicUser(toUser(result.rows[0]));
  }

  async findUserByEmail(email: string): Promise<UserWithSecret | null> {
    const result = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email],
    );
    return result.rows.length ? toUser(result.rows[0]) : null;
  }

  async findUserById(id: string): Promise<UserWithSecret | null> {
    const result = await this.db.query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [id],
    );
    return result.rows.length ? toUser(result.rows[0]) : null;
  }

  async deleteUser(id: string): Promise<void> {
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
  }

  async touchLogin(id: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [id],
    );
  }

  async createSession(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO user_sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [tokenHash, userId, expiresAt],
    );
  }

  async findSessionUser(tokenHash: string): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      `SELECT u.* FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash],
    );
    return result.rows.length ? publicUser(toUser(result.rows[0])) : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.query('DELETE FROM user_sessions WHERE token_hash = $1', [
      tokenHash,
    ]);
  }

  async getProgress(userId: string): Promise<Progress> {
    const result = await this.db.query<{ kind: ProgressKind; item_id: string }>(
      `SELECT kind, item_id FROM user_progress
       WHERE user_id = $1 ORDER BY created_at, item_id`,
      [userId],
    );
    const progress = emptyProgress();
    for (const row of result.rows) progress[row.kind].push(row.item_id);
    return progress;
  }

  async addProgress(
    userId: string,
    items: Partial<Progress>,
  ): Promise<Progress> {
    const kinds: string[] = [];
    const ids: string[] = [];
    for (const kind of PROGRESS_KINDS) {
      for (const id of items[kind] ?? []) {
        kinds.push(kind);
        ids.push(id);
      }
    }
    if (ids.length) {
      await this.db.query(
        `INSERT INTO user_progress (user_id, kind, item_id)
         SELECT $1, kind, item_id FROM UNNEST($2::text[], $3::text[]) AS t(kind, item_id)
         ON CONFLICT DO NOTHING`,
        [userId, kinds, ids],
      );
    }
    return this.getProgress(userId);
  }

  async removeProgress(
    userId: string,
    kind: ProgressKind,
    ids: string[],
  ): Promise<Progress> {
    await this.db.query(
      `DELETE FROM user_progress
       WHERE user_id = $1 AND kind = $2 AND item_id = ANY($3::text[])`,
      [userId, kind, ids],
    );
    return this.getProgress(userId);
  }

  async listPhotos(userId: string): Promise<UserPhoto[]> {
    const result = await this.db.query<PhotoRow>(
      `SELECT ${PHOTO_COLUMNS} FROM user_photos
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(toPhoto);
  }

  async addPhoto(photo: NewPhoto): Promise<UserPhoto> {
    await this.db.query(
      `INSERT INTO user_photos
         (id, user_id, governorate_id, governorate_ids, location_tag, note,
          photo, photo_mime, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, NOW()))
       ON CONFLICT (id) DO NOTHING`,
      [
        photo.id,
        photo.userId,
        photo.governorateId,
        photo.governorateIds,
        photo.locationTag,
        photo.note,
        photo.photo,
        photo.photoMime,
        photo.createdAt ?? null,
      ],
    );
    // Scoped to the owner, so a clashing id from someone else is not leaked.
    const result = await this.db.query<PhotoRow>(
      `SELECT ${PHOTO_COLUMNS} FROM user_photos WHERE id = $1 AND user_id = $2`,
      [photo.id, photo.userId],
    );
    if (!result.rows.length) throw new Error('photo id already in use');
    return toPhoto(result.rows[0]);
  }

  async findPhotoImage(
    userId: string,
    id: string,
  ): Promise<UserPhotoImage | null> {
    const result = await this.db.query<{ photo: Buffer; photo_mime: string }>(
      'SELECT photo, photo_mime FROM user_photos WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return result.rows.length
      ? { photo: result.rows[0].photo, photoMime: result.rows[0].photo_mime }
      : null;
  }

  async deletePhoto(userId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM user_photos WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listStories(userId: string): Promise<SavedStory[]> {
    const result = await this.db.query<StoryRow>(
      'SELECT * FROM user_stories WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map(toStory);
  }

  async addStory(story: NewSavedStory): Promise<SavedStory> {
    await this.db.query(
      `INSERT INTO user_stories
         (id, user_id, kind, title, location_id, governorate_ids, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
       ON CONFLICT (id) DO NOTHING`,
      [
        story.id,
        story.userId,
        story.kind,
        story.title,
        story.locationId,
        story.governorateIds,
        JSON.stringify(story.payload),
        story.createdAt ?? null,
      ],
    );
    const result = await this.db.query<StoryRow>(
      'SELECT * FROM user_stories WHERE id = $1 AND user_id = $2',
      [story.id, story.userId],
    );
    if (!result.rows.length) throw new Error('story id already in use');
    return toStory(result.rows[0]);
  }

  async deleteStory(userId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM user_stories WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

/**
 * Accounts without PostgreSQL. Everything lives for the lifetime of the
 * process only - enough to demo sign-up and sync, and the DatabaseService
 * warning already says which mode is running.
 */
export class InMemoryAccountsRepository implements AccountsRepository {
  private readonly users = new Map<string, UserWithSecret>();
  private readonly sessions = new Map<
    string,
    { userId: string; expiresAt: Date }
  >();
  private readonly progress = new Map<string, Progress>();
  private readonly photos: Array<UserPhoto & UserPhotoImage> = [];
  private readonly stories: SavedStory[] = [];

  createUser(user: NewUser): Promise<User> {
    const created: UserWithSecret = {
      id: randomUUID(),
      fullName: user.fullName,
      email: user.email,
      passwordHash: user.passwordHash,
      role: 'visitor',
      createdAt: new Date(),
    };
    this.users.set(created.id, created);
    return Promise.resolve(publicUser(created));
  }

  findUserByEmail(email: string): Promise<UserWithSecret | null> {
    const wanted = email.toLowerCase();
    return Promise.resolve(
      [...this.users.values()].find(
        (user) => user.email.toLowerCase() === wanted,
      ) ?? null,
    );
  }

  findUserById(id: string): Promise<UserWithSecret | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  deleteUser(id: string): Promise<void> {
    this.users.delete(id);
    this.progress.delete(id);
    for (const [hash, session] of this.sessions)
      if (session.userId === id) this.sessions.delete(hash);
    remove(this.photos, (item) => item.userId === id);
    remove(this.stories, (item) => item.userId === id);
    return Promise.resolve();
  }

  touchLogin(): Promise<void> {
    return Promise.resolve();
  }

  createSession(
    tokenHash: string,
    userId: string,
    expiresAt: Date,
  ): Promise<void> {
    this.sessions.set(tokenHash, { userId, expiresAt });
    return Promise.resolve();
  }

  findSessionUser(tokenHash: string): Promise<User | null> {
    const session = this.sessions.get(tokenHash);
    const user =
      session && session.expiresAt > new Date()
        ? this.users.get(session.userId)
        : undefined;
    return Promise.resolve(user ? publicUser(user) : null);
  }

  deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
    return Promise.resolve();
  }

  getProgress(userId: string): Promise<Progress> {
    const stored = this.progress.get(userId) ?? emptyProgress();
    return Promise.resolve({
      visited: [...stored.visited],
      quiz: [...stored.quiz],
      audio: [...stored.audio],
      memory_uncovered: [...stored.memory_uncovered],
    });
  }

  addProgress(userId: string, items: Partial<Progress>): Promise<Progress> {
    const stored = this.progress.get(userId) ?? emptyProgress();
    for (const kind of PROGRESS_KINDS)
      stored[kind] = [...new Set([...stored[kind], ...(items[kind] ?? [])])];
    this.progress.set(userId, stored);
    return this.getProgress(userId);
  }

  removeProgress(
    userId: string,
    kind: ProgressKind,
    ids: string[],
  ): Promise<Progress> {
    const stored = this.progress.get(userId);
    if (stored) stored[kind] = stored[kind].filter((id) => !ids.includes(id));
    return this.getProgress(userId);
  }

  listPhotos(userId: string): Promise<UserPhoto[]> {
    return Promise.resolve(
      this.photos
        .filter((item) => item.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(photoMeta),
    );
  }

  addPhoto(photo: NewPhoto): Promise<UserPhoto> {
    let stored = this.photos.find((item) => item.id === photo.id);
    if (!stored) {
      stored = { ...photo, createdAt: photo.createdAt ?? new Date() };
      this.photos.push(stored);
    }
    if (stored.userId !== photo.userId)
      return Promise.reject(new Error('photo id already in use'));
    return Promise.resolve(photoMeta(stored));
  }

  findPhotoImage(userId: string, id: string): Promise<UserPhotoImage | null> {
    const stored = this.photos.find(
      (item) => item.id === id && item.userId === userId,
    );
    return Promise.resolve(
      stored ? { photo: stored.photo, photoMime: stored.photoMime } : null,
    );
  }

  deletePhoto(userId: string, id: string): Promise<boolean> {
    return Promise.resolve(
      remove(this.photos, (item) => item.id === id && item.userId === userId),
    );
  }

  listStories(userId: string): Promise<SavedStory[]> {
    return Promise.resolve(
      this.stories
        .filter((item) => item.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  }

  addStory(story: NewSavedStory): Promise<SavedStory> {
    let stored = this.stories.find((item) => item.id === story.id);
    if (!stored) {
      stored = { ...story, createdAt: story.createdAt ?? new Date() };
      this.stories.push(stored);
    }
    if (stored.userId !== story.userId)
      return Promise.reject(new Error('story id already in use'));
    return Promise.resolve(stored);
  }

  deleteStory(userId: string, id: string): Promise<boolean> {
    return Promise.resolve(
      remove(this.stories, (item) => item.id === id && item.userId === userId),
    );
  }
}

function remove<T>(items: T[], predicate: (item: T) => boolean): boolean {
  let removed = false;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      items.splice(index, 1);
      removed = true;
    }
  }
  return removed;
}
