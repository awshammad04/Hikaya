import {
  AUDIO_KEY,
  MEMORY_UNCOVERED_KEY as MEMORY_KEY,
  PROGRESS_EVENT,
  ProgressKind,
  QUIZ_KEY,
  queueProgress,
} from "./accountSync";

export { PROGRESS_EVENT };
/** Lets a progress action anywhere in the app open the keepsake in AppLayout. */
export const OPEN_JERUSALEM_STORY_EVENT = "hikaya-quds:open-jerusalem-story";

function read(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function add(key: string, kind: ProgressKind, locationId: string) {
  const current = read(key);
  if (current.includes(locationId)) return;
  window.localStorage.setItem(key, JSON.stringify([...current, locationId]));
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  queueProgress(kind, locationId);
}

export const markQuizCompleted = (locationId: string) => add(QUIZ_KEY, "quiz", locationId);
export const markAudioListened = (locationId: string) => add(AUDIO_KEY, "audio", locationId);
export const markMemoryUncovered = (memoryId: string) => add(MEMORY_KEY, "memoryUncovered", memoryId);
export const readQuizCompleted = () => read(QUIZ_KEY);
export const readAudioListened = () => read(AUDIO_KEY);
export const readMemoriesUncovered = () => read(MEMORY_KEY);

export function openMyJerusalemStory() {
  window.dispatchEvent(new CustomEvent(OPEN_JERUSALEM_STORY_EVENT));
}
