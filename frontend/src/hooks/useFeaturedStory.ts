import { useEffect, useState } from "react";
import { FeaturedStory } from "../types";
import { getFeaturedStory, getRandomStory } from "../services/api";

interface FeaturedStoryState {
  featured: FeaturedStory | null;
  loading: boolean;
  shuffling: boolean;
  error?: string;
  /** Swaps in another reviewed story, never the one on screen. */
  shuffle: () => void;
}

/**
 * The story of the day, plus a "surprise me" that swaps it for another.
 *
 * Both home pages show it, and both report a failed load in their data-source
 * banner, so the error travels with the story.
 */
export function useFeaturedStory(): FeaturedStoryState {
  const [featured, setFeatured] = useState<FeaturedStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    getFeaturedStory()
      .then((result) => {
        if (active) setFeatured(result.data);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Story service unavailable."); })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const shuffle = async () => {
    setShuffling(true);
    try {
      const result = await getRandomStory(featured?.story.id);
      setFeatured(result.data);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Story service unavailable.");
    } finally {
      setShuffling(false);
    }
  };

  return { featured, loading, shuffling, error, shuffle: () => void shuffle() };
}
