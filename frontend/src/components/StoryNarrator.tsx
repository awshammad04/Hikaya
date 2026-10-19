import React from "react";
import {
  NarrativeReader,
  type NarrativeReaderProps,
} from "./NarrativeReader";
import type { WordTimestamp } from "../types";

export type { WordTimestamp } from "../types";

/**
 * Story-focused name for the synchronized narrative reader. Keeping this as a
 * small adapter gives story surfaces a stable API while `NarrativeReader`
 * remains available to existing callers.
 */
export interface StoryNarratorProps extends NarrativeReaderProps {
  timestamps?: readonly WordTimestamp[];
}

export const StoryNarrator: React.FC<StoryNarratorProps> = (props) => (
  <NarrativeReader {...props} />
);
