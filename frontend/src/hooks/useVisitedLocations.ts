import { useCallback, useEffect, useState } from "react";
import { locations as jerusalemLocations } from "../locationsData";

const STORAGE_KEY = "hikaya.visited";
const PROGRESS_EVENT = "hikaya-quds:progress";

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
 * Kept in `localStorage` rather than on the server because there are no
 * accounts: this is a private record of where you have been, it never leaves
 * the device, and it is not something Hikaya needs to know.
 *
 * "Progress" is progress through the locations currently in this Jerusalem
 * guide, not a claim about how much of the city itself someone has explored.
 */
export function useVisitedLocations(totalLocations: number, locationIds: string[] = jerusalemLocations.map((item) => item.id)): VisitedState {
  const [visited, setVisited] = useState<string[]>(() => read());

  // Keep multiple open tabs in step.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setVisited(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const markVisited = useCallback((locationId: string) => {
    setVisited((current) => {
      if (current.includes(locationId)) return current;
      const next = [...current, locationId];
      write(next);
      window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
      return next;
    });
  }, []);

  const scopeKey = locationIds.join("|");
  const reset = useCallback(() => {
    const remaining = read().filter((id) => !locationIds.includes(id));
    write(remaining);
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
