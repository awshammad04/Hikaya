import { useEffect, useState } from "react";
import {
  deleteStory,
  readSavedStories,
  SAVED_STORIES_KEY,
  saveStory,
  SavedStory,
  STORIES_EVENT,
} from "../services/accountSync";

/** Stories kept in the passport: generated journeys and location stories. */
export function useSavedStories() {
  const [stories, setStories] = useState<SavedStory[]>(readSavedStories);

  useEffect(() => {
    const update = () => setStories(readSavedStories());
    const onStorage = (event: StorageEvent) => {
      if (event.key === SAVED_STORIES_KEY) update();
    };
    window.addEventListener(STORIES_EVENT, update);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(STORIES_EVENT, update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { stories, saveStory, deleteStory };
}
