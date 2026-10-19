import { Provider } from '@nestjs/common';
import {
  CONTRIBUTIONS_REPOSITORY,
  LOCATIONS_REPOSITORY,
  MEDIA_REPOSITORY,
  QUIZ_REPOSITORY,
  STORIES_REPOSITORY,
  TIMELINE_REPOSITORY,
} from '../database/repositories/tokens';
import { InMemoryLocationsRepository } from '../database/repositories/locations.repository';
import { InMemoryStoriesRepository } from '../database/repositories/stories.repository';
import { InMemoryContributionsRepository } from '../database/repositories/contributions.repository';
import { InMemoryMediaRepository } from '../database/repositories/media.repository';
import { InMemoryTimelineRepository } from '../database/repositories/timeline.repository';
import { InMemoryQuizRepository } from '../database/repositories/quiz.repository';

/**
 * Every repository token, bound to its in-memory implementation.
 *
 * Test modules import this instead of listing providers one by one, so adding a
 * repository does not mean editing every spec. The in-memory repositories serve
 * the same seed data as PostgreSQL, which is what makes them worth testing
 * against rather than mocking.
 *
 * Each spec gets fresh instances because Nest constructs the classes per
 * testing module, so state written in one test cannot leak into another.
 */
export const IN_MEMORY_REPOSITORY_PROVIDERS: Provider[] = [
  { provide: LOCATIONS_REPOSITORY, useClass: InMemoryLocationsRepository },
  { provide: STORIES_REPOSITORY, useClass: InMemoryStoriesRepository },
  {
    provide: CONTRIBUTIONS_REPOSITORY,
    useClass: InMemoryContributionsRepository,
  },
  { provide: MEDIA_REPOSITORY, useClass: InMemoryMediaRepository },
  { provide: TIMELINE_REPOSITORY, useClass: InMemoryTimelineRepository },
  { provide: QUIZ_REPOSITORY, useClass: InMemoryQuizRepository },
];
