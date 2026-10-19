/**
 * Shapes returned by the AI module, matching ai/api-contract.md.
 *
 * The AI service speaks snake_case; these interfaces describe that wire format.
 * AiService converts it to the camelCase response the frontend consumes.
 */
export interface AiSourceInfo {
  location_id?: string | null;
  location_name?: string | null;
  content_file?: string | null;
  summary_file?: string | null;
  provided_inline?: boolean;
  governorate_id?: string | null;
  references?: { title: string; url: string }[];
}

export interface AiModelInfo {
  provider: string;
  name: string;
}

/** Raw response body from POST {AI_SERVICE_URL}/generate-story. */
export interface AiStoryResponse {
  status: 'ok' | 'partial' | 'error';
  title: string;
  summary: string;
  narrative: string;
  target_audience: string;
  language: string;
  tone: string;
  word_count: number;
  uncertainty_notes: string[];
  warnings: string[];
  source: AiSourceInfo;
  model: AiModelInfo;
  error?: { code: string; message: string } | null;
}

/** Raw response body from POST {AI_SERVICE_URL}/ask-guide. */
export interface AiGuideResponse {
  status: 'ok' | 'error';
  answer: string;
  answered_from_source: boolean;
  excerpts: string[];
  uncertainty_notes: string[];
  source: AiSourceInfo;
  sources?: AiSourceInfo[];
  model: AiModelInfo;
  error?: { code: string; message: string } | null;
}

/** What the backend returns to the frontend. */
export interface GeneratedStory {
  title: string;
  summary: string;
  narrative: string;
  targetAudience: string;
  language: string;
  tone: string;
  wordCount: number;
  /** Gaps the AI declined to fill. Safe to show the reader as a footnote. */
  uncertaintyNotes: string[];
  /** Fact-guard findings. For reviewers, not for the reader. */
  warnings: string[];
  source: {
    locationId?: string | null;
    locationName?: string | null;
    contentFile?: string | null;
    summaryFile?: string | null;
  };
  /** `anthropic`, `offline-extractive`, or `backend-fallback`. */
  generatedBy: string;
  /** Id of the stored story awaiting review, when it was persisted. */
  storyId?: string;
}

export interface GuideAnswer {
  answer: string;
  answeredFromSource: boolean;
  excerpts: string[];
  uncertaintyNotes: string[];
  generatedBy: string;
  sources?: AiSourceInfo[];
}
