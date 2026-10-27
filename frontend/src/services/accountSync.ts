import type { UserJourneyMemory } from "../types";

/**
 * Accounts and guest mode.
 *
 * Every visitor starts as a guest: progress, photos and saved stories live in
 * this browser's localStorage, exactly as before accounts existed. Signing up
 * or logging in merges that guest journey into the account, and from then on
 * every change is mirrored to the API. The UI keeps reading localStorage, so
 * nothing on screen depends on the network, and signing out wipes the copy
 * from the device.
 */

export const VISITED_KEY = "hikaya.visited";
export const QUIZ_KEY = "hikaya-quds.quiz-completed";
export const AUDIO_KEY = "hikaya-quds.audio-listened";
export const MEMORY_UNCOVERED_KEY = "hikaya-quds.memories-uncovered";
export const USER_MEMORIES_KEY = "hikaya-quds.user-journey-memories";
export const SAVED_STORIES_KEY = "hikaya.saved-stories";
const GUEST_KEY = "hikaya.guest";
/** Which account the device's copy belongs to, so it is never merged into another. */
const OWNER_KEY = "hikaya.account-owner";
/** Belongs to whoever is signed in, so it leaves the device on sign-out. */
const ACCOUNT_KEYS = [
  VISITED_KEY,
  QUIZ_KEY,
  AUDIO_KEY,
  MEMORY_UNCOVERED_KEY,
  USER_MEMORIES_KEY,
  SAVED_STORIES_KEY,
  "hikaya.palestine.journey.v1",
  "hikaya-quds.itinerary",
  OWNER_KEY,
];

export const PROGRESS_EVENT = "hikaya-quds:progress";
export const MEMORIES_EVENT = "hikaya-quds:user-memories";
export const STORIES_EVENT = "hikaya:saved-stories";

export type ProgressKind = "visited" | "quiz" | "audio" | "memoryUncovered";
const PROGRESS_KEYS: Record<ProgressKind, string> = {
  visited: VISITED_KEY,
  quiz: QUIZ_KEY,
  audio: AUDIO_KEY,
  memoryUncovered: MEMORY_UNCOVERED_KEY,
};
type ProgressLists = Record<ProgressKind, string[]>;

/** The API rejects anything else, so such ids simply stay device-only. */
const SAFE_ID = /^[A-Za-z0-9_:.-]{1,120}$/;
const SAFE_RECORD_ID = /^[A-Za-z0-9-]{8,64}$/;
const MAX_LOCAL_STORIES = 30;

export interface AccountUser {
  id: string;
  fullName: string;
  /** Optional contact address given at sign-up; never a login. */
  email: string | null;
  /** E.164, e.g. +970599123456. */
  phone: string | null;
  role: string;
  createdAt: string;
}

export interface SavedStory {
  id: string;
  /** `my_story` is one the visitor wrote; private unless they shared it. */
  kind: "journey" | "location_story" | "my_story";
  title: string;
  locationId?: string | null;
  governorateIds: string[];
  payload: unknown;
  createdAt: string;
}

export interface AccountContribution {
  id: string;
  referenceCode?: string;
  locationId: string;
  title: string;
  status: "pending_review" | "approved" | "rejected";
  reviewNotes?: string | null;
  submittedAt: string;
}

/** The payload of a story the visitor wrote themselves. */
export interface MyStoryPayload {
  content: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio" | "video";
  /** Set once it was sent for review; the public copy is a contribution. */
  share?: {
    referenceCode?: string;
    contributionId: string;
    /** The name shown with it, or null when only the story was shared. */
    creditedAs: string | null;
    sharedAt: string;
  };
}

export type ContributionStatus = AccountContribution["status"];

/** A submission as the review team sees it. */
export interface ReviewItem {
  id: string;
  referenceCode?: string;
  locationId: string;
  title: string;
  content: string;
  contributorName?: string;
  contributorEmail?: string;
  mediaUrl?: string;
  mediaType?: "image" | "audio" | "video";
  status: ContributionStatus;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  submittedAt: string;
}

export interface ReviewQueue {
  status: ContributionStatus;
  items: ReviewItem[];
  counts: Record<ContributionStatus, number>;
}

/** Editors and admins can open the review queue. */
export const isReviewerRole = (role: string | undefined) => role === "editor" || role === "admin";

/** Fired after a review decision so the header badge can recount. */
export const REVIEW_EVENT = "hikaya:review-queue";

interface RemotePhoto {
  id: string;
  governorateId: string | null;
  governorateIds: string[];
  locationTag: string;
  note: string;
  createdAt: string;
  photoUrl: string;
}

export interface MergeSummary {
  places: number;
  quizzes: number;
  narrations: number;
  photos: number;
  stories: number;
}

export class AccountError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "AccountError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Always the same-origin bridge: the session cookie is scoped to it.
  const response = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = Array.isArray(body?.message)
      ? body.message.join(" · ")
      : typeof body?.message === "string"
        ? body.message
        : `Request failed (${response.status})`;
    throw new AccountError(message, response.status);
  }
  return body as T;
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const accountApi = {
  me: () => request<{ user: AccountUser | null }>("/auth/me"),
  signUp: (name: string, countryCode: string, phone: string, password: string, email?: string) =>
    request<{ user: AccountUser }>("/auth/signup", post({ name, countryCode, phone, password, email: email?.trim() || undefined })),
  logIn: (countryCode: string, phone: string, password: string) =>
    request<{ user: AccountUser }>("/auth/login", post({ countryCode, phone, password })),
  logOut: () => request<void>("/auth/logout", post({})),
  deleteAccount: (password: string) =>
    request<void>("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }),
  contributions: () => request<AccountContribution[]>("/me/contributions"),
};

export const reviewApi = {
  queue: (status: ContributionStatus) =>
    request<ReviewQueue>(`/admin/contributions?status=${encodeURIComponent(status)}`),
  review: async (id: string, decision: "approved" | "rejected", notes?: string) => {
    const reviewed = await request<ReviewItem>(
      `/admin/contributions/${encodeURIComponent(id)}/review`,
      post({ decision, notes: notes?.trim() || undefined }),
    );
    notify(REVIEW_EVENT);
    return reviewed;
  },
};

// --- Local storage -----------------------------------------------------------

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the account copy, if any, is still intact.
  }
}

export function readIdList(key: string): string[] {
  const value = readJson<unknown>(key, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const notify = (event: string) => window.dispatchEvent(new CustomEvent(event));

export function readSavedStories(): SavedStory[] {
  const value = readJson<unknown>(SAVED_STORIES_KEY, []);
  return Array.isArray(value)
    ? value.filter((item): item is SavedStory =>
        Boolean(item) && typeof item.id === "string" && typeof item.title === "string" && typeof item.kind === "string")
    : [];
}

function writeSavedStories(stories: SavedStory[]) {
  writeJson(SAVED_STORIES_KEY, stories.slice(0, MAX_LOCAL_STORIES));
  notify(STORIES_EVENT);
}

function readLocalMemories(): UserJourneyMemory[] {
  const value = readJson<unknown>(USER_MEMORIES_KEY, []);
  return Array.isArray(value) ? (value as UserJourneyMemory[]) : [];
}

function writeLocalMemories(memories: UserJourneyMemory[]) {
  writeJson(USER_MEMORIES_KEY, memories);
  notify(MEMORIES_EVENT);
}

export function newRecordId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** What this device holds right now - shown to guests and on sign-in. */
export function journeyTotals(): MergeSummary {
  return {
    places: readIdList(VISITED_KEY).length,
    quizzes: readIdList(QUIZ_KEY).length,
    narrations: readIdList(AUDIO_KEY).length,
    photos: readLocalMemories().length,
    stories: readSavedStories().length,
  };
}

// --- Guest passport ----------------------------------------------------------

/**
 * When this device's guest passport was opened. Older builds also stored a
 * made-up guest name and number here; rewriting the record drops them.
 */
export function guestSince(): string {
  const stored = readJson<{ since?: string } | null>(GUEST_KEY, null);
  const since = stored?.since || new Date().toISOString();
  writeJson(GUEST_KEY, { since });
  return since;
}

// --- Live mirroring while signed in ------------------------------------------

let signedIn = false;
const pending: ProgressLists = { visited: [], quiz: [], audio: [], memoryUncovered: [] };
let flushTimer: number | undefined;

export function setSignedIn(value: boolean) {
  signedIn = value;
}

export const isSignedIn = () => signedIn;

export function deviceOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function markDeviceOwner(userId: string) {
  try {
    window.localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // Without storage there is no device copy to protect.
  }
}

/** Mirror one progress item to the account; batched so a page load is one call. */
export function queueProgress(kind: ProgressKind, id: string) {
  if (!signedIn || !SAFE_ID.test(id)) return;
  if (!pending[kind].includes(id)) pending[kind].push(id);
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => void flushProgress(), 400);
}

export async function flushProgress() {
  window.clearTimeout(flushTimer);
  const batch: ProgressLists = { ...pending };
  if (!Object.values(batch).some((items) => items.length)) return;
  (Object.keys(pending) as ProgressKind[]).forEach((kind) => { pending[kind] = []; });
  // A failed mirror is not lost: the next sync re-sends everything local.
  await request("/me/progress", post(batch)).catch(() => undefined);
}

export function forgetProgress(kind: ProgressKind, ids: string[]) {
  const safe = ids.filter((id) => SAFE_ID.test(id));
  if (!signedIn || !safe.length) return;
  void request("/me/progress/remove", post({ kind, ids: safe })).catch(() => undefined);
}

function toLocalMemory(photo: RemotePhoto): UserJourneyMemory {
  return {
    id: photo.id,
    photoDataUrl: photo.photoUrl,
    locationTag: photo.locationTag,
    note: photo.note,
    governorateId: photo.governorateId ?? undefined,
    governorateIds: photo.governorateIds.length ? photo.governorateIds : undefined,
    createdAt: photo.createdAt,
  };
}

async function sendMemory(memory: UserJourneyMemory): Promise<RemotePhoto | null> {
  if (!memory.photoDataUrl.startsWith("data:image/") || !SAFE_RECORD_ID.test(memory.id)) return null;
  return request<RemotePhoto>("/me/photos", post({
    id: memory.id,
    photoDataUrl: memory.photoDataUrl,
    locationTag: memory.locationTag.slice(0, 160),
    note: memory.note.slice(0, 2000),
    governorateId: memory.governorateId,
    governorateIds: memory.governorateIds,
    createdAt: memory.createdAt,
  })).catch(() => null);
}

/**
 * Upload a new journey photo, then swap the bulky data URL on the device for
 * the account's image URL so the local album stops eating storage quota.
 */
export async function uploadMemory(memory: UserJourneyMemory) {
  if (!signedIn) return;
  const saved = await sendMemory(memory);
  if (!saved) return;
  writeLocalMemories(readLocalMemories().map((item) => (item.id === saved.id ? toLocalMemory(saved) : item)));
}

export function deleteMemory(id: string) {
  writeLocalMemories(readLocalMemories().filter((item) => item.id !== id));
  if (signedIn) void request(`/me/photos/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
}

async function sendStory(story: SavedStory): Promise<SavedStory | null> {
  if (!SAFE_RECORD_ID.test(story.id)) return null;
  return request<SavedStory>("/me/stories", post({
    id: story.id,
    kind: story.kind,
    title: story.title.slice(0, 200),
    locationId: story.locationId ?? undefined,
    governorateIds: story.governorateIds,
    payload: story.payload,
    createdAt: story.createdAt,
  })).catch(() => null);
}

/** Keep a story in the passport (and the account, when signed in). */
export function saveStory(story: Omit<SavedStory, "id" | "createdAt"> & Partial<Pick<SavedStory, "id" | "createdAt">>) {
  const saved: SavedStory = { ...story, id: story.id ?? newRecordId(), createdAt: story.createdAt ?? new Date().toISOString() };
  writeSavedStories([saved, ...readSavedStories().filter((item) => item.id !== saved.id)]);
  if (signedIn) void sendStory(saved);
  return saved;
}

/**
 * Replace a kept story, e.g. once a private story has been shared. The API
 * keeps the first copy of an id, so the account copy is removed and re-sent.
 */
export async function updateStory(story: SavedStory) {
  writeSavedStories(readSavedStories().map((item) => (item.id === story.id ? story : item)));
  if (!signedIn) return;
  await request(`/me/stories/${encodeURIComponent(story.id)}`, { method: "DELETE" }).catch(() => undefined);
  await sendStory(story);
}

export function deleteStory(id: string) {
  writeSavedStories(readSavedStories().filter((item) => item.id !== id));
  if (signedIn) void request(`/me/stories/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
}

// --- Merge on sign-in, and on every load while signed in ---------------------

/**
 * Two-way merge between this device and the account. Union semantics: nothing
 * is ever dropped, so it is safe to run on every page load and from several
 * devices. Returns how much of the device's journey was new to the account.
 */
export async function syncAccount(): Promise<MergeSummary> {
  const localProgress: ProgressLists = {
    visited: readIdList(VISITED_KEY),
    quiz: readIdList(QUIZ_KEY),
    audio: readIdList(AUDIO_KEY),
    memoryUncovered: readIdList(MEMORY_UNCOVERED_KEY),
  };
  const before = await request<ProgressLists>("/me/progress");
  const merged = await request<ProgressLists>("/me/progress", post(Object.fromEntries(
    (Object.keys(localProgress) as ProgressKind[]).map((kind) => [kind, localProgress[kind].filter((id) => SAFE_ID.test(id))]),
  )));
  const fresh = (kind: ProgressKind) => localProgress[kind].filter((id) => !before[kind].includes(id)).length;
  (Object.keys(PROGRESS_KEYS) as ProgressKind[]).forEach((kind) => {
    // Keep device-only ids the API would not accept alongside the account's.
    writeJson(PROGRESS_KEYS[kind], [...new Set([...merged[kind], ...localProgress[kind]])]);
  });
  notify(PROGRESS_EVENT);

  const remotePhotos = await request<RemotePhoto[]>("/me/photos");
  const remotePhotoIds = new Set(remotePhotos.map((item) => item.id));
  let photos = 0;
  for (const memory of readLocalMemories()) {
    if (remotePhotoIds.has(memory.id)) continue;
    const saved = await sendMemory(memory);
    if (saved) {
      remotePhotos.push(saved);
      photos += 1;
    }
  }
  const unsent = readLocalMemories().filter((item) => !remotePhotos.some((photo) => photo.id === item.id) && item.photoDataUrl.startsWith("data:"));
  writeLocalMemories([...unsent, ...remotePhotos.map(toLocalMemory)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  const remoteStories = await request<SavedStory[]>("/me/stories");
  const remoteStoryIds = new Set(remoteStories.map((item) => item.id));
  let stories = 0;
  for (const story of readSavedStories()) {
    if (remoteStoryIds.has(story.id)) continue;
    const saved = await sendStory(story);
    if (saved) {
      remoteStories.push(saved);
      stories += 1;
    }
  }
  writeSavedStories([...remoteStories].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

  return {
    places: fresh("visited"),
    quizzes: fresh("quiz"),
    narrations: fresh("audio"),
    photos,
    stories,
  };
}

/** Sign-out: the account keeps everything; this shared device keeps nothing. */
export function clearAccountDataFromDevice() {
  ACCOUNT_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  });
  (Object.keys(pending) as ProgressKind[]).forEach((kind) => { pending[kind] = []; });
  [PROGRESS_EVENT, MEMORIES_EVENT, STORIES_EVENT].forEach(notify);
}

/** Inline account-hosted photos so a downloaded keepsake works offline. */
export async function photoAsDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  try {
    const blob = await (await fetch(src, { credentials: "same-origin" })).blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return src;
  }
}
