import rawCatalog from './palestine-catalog.json';
import { PalestineCatalog } from './palestine.types';
const catalog: PalestineCatalog = rawCatalog;
import { Location } from '../entities/location.entity';
import { Story } from '../entities/story.entity';
import { TimelineEvent } from '../entities/timeline-event.entity';
import { QuizQuestion } from '../entities/quiz-question.entity';

export { catalog };
export const PALESTINE_LOCATIONS: Location[] = catalog.locations.map(
  (item) => ({
    ...item,
    country: 'Palestine',
    isPublished: item.reviewed && item.reviewStatus === 'source_checked',
    contentFile: `content/ai-ready/${item.id}-summary.md`,
    aiSummaryFile: `content/ai-ready/${item.id}-summary.md`,
  }),
);
export const PALESTINE_STORIES: Story[] = catalog.locations.map((item) => ({
  id: `record-${item.id}`,
  locationId: item.id,
  title: item.name,
  summary: item.description,
  simplifiedStory: `${item.description} ${item.facts}`,
  audience: 'general',
  language: 'en',
  tone: 'neutral',
  source: `content/ai-ready/${item.id}-summary.md`,
  isAiGenerated: false,
  uncertaintyNotes: [catalog.gaps.en],
  status:
    item.reviewed && item.reviewStatus === 'source_checked'
      ? 'published'
      : 'pending_review',
}));
export const PALESTINE_TIMELINE: TimelineEvent[] = catalog.locations.flatMap(
  (item) =>
    item.timeline.map((event, index) => ({
      id: `palestine-timeline-${item.id}-${index}`,
      locationId: item.id,
      periodLabel: event.label,
      description: event.description,
      sortYear: event.year,
      sortOrder: index,
      isTradition: false,
      sourceFile: `content/ai-ready/${item.id}-summary.md`,
    })),
);
export const PALESTINE_QUIZ: QuizQuestion[] = catalog.locations.map((item) => ({
  id: `palestine-quiz-${item.id}`,
  locationId: item.id,
  ...item.quiz,
  explanation: `${item.description} ${item.facts} ${item.traditions}`,
  sourceNote: item.sources[0].url,
  sortOrder: 0,
}));
