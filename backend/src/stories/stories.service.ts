import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Story } from '../database/entities/story.entity';
import { Location } from '../database/entities/location.entity';
import type {
  NewStory,
  StoriesRepository,
} from '../database/repositories/stories.repository';
import type { LocationsRepository } from '../database/repositories/locations.repository';
import {
  LOCATIONS_REPOSITORY,
  STORIES_REPOSITORY,
} from '../database/repositories/tokens';

export interface FeaturedStory {
  story: Story;
  location: Location | null;
  /**
   * Why this story is on screen today. Named `rotation` rather than
   * "on this day" because the reviewed content dates events to a year at best -
   * claiming an anniversary would be inventing a precision the records do not have.
   */
  reason: 'daily-rotation' | 'random';
  /** ISO date the daily rotation was computed for. */
  forDate?: string;
}

@Injectable()
export class StoriesService {
  constructor(
    @Inject(STORIES_REPOSITORY)
    private readonly stories: StoriesRepository,
    @Inject(LOCATIONS_REPOSITORY)
    private readonly locations: LocationsRepository,
  ) {}

  findByLocation(locationId: string): Promise<Story[]> {
    return this.stories.findByLocation(locationId);
  }

  async findOne(id: string): Promise<Story> {
    const story = await this.stories.findById(id);
    if (!story) {
      throw new NotFoundException(`Story with id "${id}" not found`);
    }
    return story;
  }

  create(story: NewStory): Promise<Story> {
    return this.stories.create(story);
  }

  /**
   * The story of the day.
   *
   * Chosen by days-since-epoch modulo the number of published stories, so every
   * visitor sees the same story on a given day and a different one tomorrow.
   * Deterministic on purpose: a random pick per request would change under the
   * reader mid-visit and could not be linked to or talked about.
   */
  async findFeatured(now = new Date()): Promise<FeaturedStory | null> {
    const published = await this.orderedPublished();
    if (!published.length) {
      return null;
    }
    const dayNumber = Math.floor(now.getTime() / 86_400_000);
    const story = published[dayNumber % published.length];
    return {
      story,
      location: await this.locations.findById(story.locationId),
      reason: 'daily-rotation',
      forDate: now.toISOString().slice(0, 10),
    };
  }

  /** A published story picked at random, for the "surprise me" button. */
  async findRandom(excludeId?: string): Promise<FeaturedStory | null> {
    const published = await this.orderedPublished();
    const pool = published.filter((story) => story.id !== excludeId);
    const choices = pool.length ? pool : published;
    if (!choices.length) {
      return null;
    }
    const story = choices[Math.floor(Math.random() * choices.length)];
    return {
      story,
      location: await this.locations.findById(story.locationId),
      reason: 'random',
    };
  }

  /**
   * Published stories in a stable order.
   *
   * The daily rotation indexes into this list, so the order must not depend on
   * insertion time or the repository implementation - otherwise "today's story"
   * would differ between the PostgreSQL and in-memory backends.
   */
  private async orderedPublished(): Promise<Story[]> {
    const published = await this.stories.findAllPublished();
    const locations = await this.locations.findAll();
    const jerusalemIds = new Set(
      locations
        .filter((item) => (item.governorateId ?? 'jerusalem') === 'jerusalem')
        .map((item) => item.id),
    );
    return published
      .filter((item) => jerusalemIds.has(item.locationId))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
}
