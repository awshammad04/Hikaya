import { useCallback, useEffect, useState } from "react";
import { locations as jerusalemLocations } from "../locationsData";
import {
  forgetProgress,
  PROGRESS_EVENT,
  queueProgress,
  VISITED_KEY as STORAGE_KEY,
} from "../services/accountSync";

export interface Badge {
  id: string;
  label: string;
  description: string;
  /** How many locations must be visited to earn it. */
  threshold: number;
  earned: boolean;
}

export interface VisitedState {
  visited: string[];
  total: number;
  percentComplete: number;
  badges: Badge[];
  markVisited: (locationId: string) => void;
  reset: () => void;
  hasVisited: (locationId: string) => boolean;
}

/**
 * Tracks which locations this browser has opened.
 *
 * Kept in `localStorage`, a private record of where you have been. Guests
 * keep it on this device only; signed-in visitors also have it mirrored to
 * their account (see services/accountSync.ts) so it follows them.
 *
 * "Progress" is progress through the locations currently in this Jerusalem
 * guide, not a claim about how much of the city itself someone has explored.
 */
export function useVisitedLocations(totalLocations: number, locationIds: string[] = jerusalemLocations.map((item) => item.id)): VisitedState {
  const [visited, setVisited] = useState<string[]>(() => read());

  // Keep multiple open tabs, and account sync, in step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setVisited(read());
    };
    const onProgress = () => setVisited(read());
    window.addEventListener("storage", onStorage);
    window.addEventListener(PROGRESS_EVENT, onProgress);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROGRESS_EVENT, onProgress);
    };
  }, []);

  const markVisited = useCallback((locationId: string) => {
    setVisited((current) => {
      if (current.includes(locationId)) return current;
      const next = [...current, locationId];
      write(next);
      queueProgress("visited", locationId);
      // Announce after this state update so listeners re-read storage safely.
      queueMicrotask(() => window.dispatchEvent(new CustomEvent(PROGRESS_EVENT)));
      return next;
    });
  }, []);

  const scopeKey = locationIds.join("|");
  const reset = useCallback(() => {
    const current = read();
    const remaining = current.filter((id) => !locationIds.includes(id));
    write(remaining);
    forgetProgress("visited", current.filter((id) => locationIds.includes(id)));
    setVisited(remaining);
    window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
  }, [scopeKey]);

  const hasVisited = useCallback(
    (locationId: string) => visited.includes(locationId),
    [visited],
  );

  const scopedVisited = visited.filter((id) => locationIds.includes(id));
  const percentComplete = totalLocations > 0 ? Math.min(100, Math.round((scopedVisited.length / totalLocations) * 100)) : 0;

  return {
    visited: scopedVisited,
    total: totalLocations,
    percentComplete,
    badges: buildBadges(scopedVisited.length, totalLocations),
    markVisited,
    reset,
    hasVisited,
  };
}

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    // Private browsing, a full quota, or hand-edited junk in storage. None of
    // those are worth breaking the page over.
    return [];
  }
}

function write(visited: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visited));
  } catch {
    // Ignore: the tracker is a nicety, not something to fail a page load for.
  }
}

function buildBadges(count: number, total: number): Badge[] {
  const definitions: Omit<Badge, "earned">[] = [
    {
      id: "first-step",
      label: "First step",
      description: "Opened your first Jerusalem quarter.",
      threshold: 1,
    },
    {
      id: "wanderer",
      label: "Jerusalem storyteller",
      description: "Opened three locations.",
      threshold: 3,
    },
    {
      id: "archivist",
      label: "حارس حكاية",
      description: "Opened every Jerusalem location in the guide.",
      threshold: Math.max(total, 1),
    },
  ];

  // Deduplicate thresholds so a small future collection never awards two
  // differently named badges for the same action.
  const seen = new Set<number>();
  return definitions
    .filter((badge) => {
      if (seen.has(badge.threshold)) return false;
      seen.add(badge.threshold);
      return true;
    })
    .map((badge) => ({ ...badge, earned: count >= badge.threshold }));
}
