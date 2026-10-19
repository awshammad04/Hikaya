const QUIZ_KEY = "hikaya-quds.quiz-completed";
const AUDIO_KEY = "hikaya-quds.audio-listened";
const MEMORY_KEY = "hikaya-quds.memories-uncovered";
export const PROGRESS_EVENT = "hikaya-quds:progress";
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

function add(key: string, locationId: string) {
  const next = Array.from(new Set([...read(key), locationId]));
  window.localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
}

export const markQuizCompleted = (locationId: string) => add(QUIZ_KEY, locationId);
export const markAudioListened = (locationId: string) => add(AUDIO_KEY, locationId);
export const markMemoryUncovered = (memoryId: string) => add(MEMORY_KEY, memoryId);
export const readQuizCompleted = () => read(QUIZ_KEY);
export const readAudioListened = () => read(AUDIO_KEY);
export const readMemoriesUncovered = () => read(MEMORY_KEY);

export function openMyJerusalemStory() {
  window.dispatchEvent(new CustomEvent(OPEN_JERUSALEM_STORY_EVENT));
}
