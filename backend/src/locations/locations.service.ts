import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Location } from '../database/entities/location.entity';
import { MediaItem } from '../database/entities/media.entity';
import { QuizQuestion } from '../database/entities/quiz-question.entity';
import { TimelineEvent } from '../database/entities/timeline-event.entity';
import type { LocationsRepository } from '../database/repositories/locations.repository';
import type {
  BeforeAfterPair,
  MediaRepository,
} from '../database/repositories/media.repository';
import type { TimelineRepository } from '../database/repositories/timeline.repository';
import type { QuizRepository } from '../database/repositories/quiz.repository';
import type { StoriesRepository } from '../database/repositories/stories.repository';
import type { ContributionsRepository } from '../database/repositories/contributions.repository';
import {
  CONTRIBUTIONS_REPOSITORY,
  LOCATIONS_REPOSITORY,
  MEDIA_REPOSITORY,
  QUIZ_REPOSITORY,
  STORIES_REPOSITORY,
  TIMELINE_REPOSITORY,
} from '../database/repositories/tokens';

/** Average adult reading speed, used to estimate how long a location takes to read. */
const WORDS_PER_MINUTE = 200;

export interface LocationStats {
  storyCount: number;
  imageCount: number;
  timelineEventCount: number;
  memoryCount: number;
  /** Rounded up, minimum 1 when there is anything to read at all. */
  readingTimeMinutes: number;
}

export type LocationWithStats = Location & { stats: LocationStats };

@Injectable()
export class LocationsService {
  constructor(
    @Inject(LOCATIONS_REPOSITORY)
    private readonly locations: LocationsRepository,
    @Inject(MEDIA_REPOSITORY)
    private readonly media: MediaRepository,
    @Inject(TIMELINE_REPOSITORY)
    private readonly timeline: TimelineRepository,
    @Inject(QUIZ_REPOSITORY)
    private readonly quiz: QuizRepository,
    @Inject(STORIES_REPOSITORY)
    private readonly stories: StoriesRepository,
    @Inject(CONTRIBUTIONS_REPOSITORY)
    private readonly contributions: ContributionsRepository,
  ) {}

  async findAll(governorateId = 'jerusalem'): Promise<Location[]> {
    const all = await this.locations.findAll();
    return governorateId === 'all'
      ? all
      : all.filter(
          (item) => (item.governorateId ?? 'jerusalem') === governorateId,
        );
  }

  async findOne(id: string): Promise<Location> {
    const location = await this.locations.findById(id);
    if (!location) {
      throw new NotFoundException(`Location with id "${id}" not found`);
    }
    return location;
  }

  /**
   * Locations with the counts the cards show: stories, images, timeline entries,
   * published memories, and an estimated reading time.
   *
   * The counts come from four grouped queries rather than one per location, so
   * the cost does not grow with the number of locations.
   */
  async findAllWithStats(
    governorateId = 'jerusalem',
  ): Promise<LocationWithStats[]> {
    const [locations, storyStats, imageCounts, timelineCounts, memoryCounts] =
      await Promise.all([
        this.findAll(governorateId),
        this.stories.statsByLocation(),
        this.media.countsByLocation(),
        this.timeline.countsByLocation(),
        this.contributions.countsApprovedByLocation(),
      ]);

    return locations.map((location) => {
      const stories = storyStats[location.id] ?? { count: 0, words: 0 };
      return {
        ...location,
        stats: {
          storyCount: stories.count,
          imageCount: imageCounts[location.id] ?? 0,
          timelineEventCount: timelineCounts[location.id] ?? 0,
          memoryCount: memoryCounts[location.id] ?? 0,
          readingTimeMinutes: stories.words
            ? Math.max(1, Math.ceil(stories.words / WORDS_PER_MINUTE))
            : 0,
        },
      };
    });
  }

  async findMedia(id: string): Promise<MediaItem[]> {
    await this.findOne(id);
    return this.media.findByLocation(id);
  }

  /**
   * Returns `null` when the location has no historical photograph of the same
   * subject as a present-day one. The UI says so rather than pairing two
   * unrelated images and calling it a comparison.
   */
  async findBeforeAfter(id: string): Promise<BeforeAfterPair | null> {
    await this.findOne(id);
    return this.media.findPair(id);
  }

  async findTimeline(id: string): Promise<TimelineEvent[]> {
    await this.findOne(id);
    return this.timeline.findByLocation(id);
  }

  async findQuiz(id: string): Promise<QuizQuestion[]> {
    await this.findOne(id);
    return this.quiz.findByLocation(id);
  }

  /**
   * Other locations that share at least one category, most overlap first.
   *
   * With eight guide locations this is still small; the shape is what matters,
   * because it is how the archive stays navigable as locations are added.
   */
  async findRelated(id: string, limit = 3): Promise<Location[]> {
    const location = await this.findOne(id);
    const categories = new Set(location.categories);
    const all = await this.locations.findAll();

    return all
      .filter(
        (candidate) =>
          candidate.id !== id &&
          (candidate.governorateId ?? 'jerusalem') ===
            (location.governorateId ?? 'jerusalem'),
      )
      .map((candidate) => ({
        candidate,
        shared: candidate.categories.filter((category) =>
          categories.has(category),
        ).length,
      }))
      .filter((entry) => entry.shared > 0)
      .sort(
        (a, b) =>
          b.shared - a.shared ||
          a.candidate.name.localeCompare(b.candidate.name),
      )
      .slice(0, limit)
      .map((entry) => entry.candidate);
  }
}
