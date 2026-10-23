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
  summary?: string;
}

export const StoryNarrator: React.FC<StoryNarratorProps> = ({
  summary,
  ...props
}) => {
  let text = props.text;
  const summaryIndex = summary ? text.indexOf(summary) : -1;
  if (summaryIndex >= 0 && summaryIndex <= 120) {
    const withoutSummary =
      `${text.slice(0, summaryIndex)}${text.slice(summaryIndex + summary.length)}`
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    if (withoutSummary) text = withoutSummary;
  }
  return <NarrativeReader {...props} text={text} />;
};
