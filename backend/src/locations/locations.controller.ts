import { Controller, Get, Param, Query } from '@nestjs/common';
import { LocationsService, LocationWithStats } from './locations.service';
import { Location } from '../database/entities/location.entity';
import { MediaItem } from '../database/entities/media.entity';
import { QuizQuestion } from '../database/entities/quiz-question.entity';
import { TimelineEvent } from '../database/entities/timeline-event.entity';
import type { BeforeAfterPair } from '../database/repositories/media.repository';

/**
 * Locations endpoints.
 *
 * GET /api/v1/locations                  -> published locations, with counts
 * GET /api/v1/locations/:id              -> one location by slug
 * GET /api/v1/locations/:id/media        -> gallery images with credit and licence
 * GET /api/v1/locations/:id/before-after -> historical/present pair, or null
 * GET /api/v1/locations/:id/timeline     -> historical timeline
 * GET /api/v1/locations/:id/quiz         -> comprehension questions
 * GET /api/v1/locations/:id/related      -> locations sharing a category
 *
 * The sub-resource routes are declared before `:id` alone would swallow them;
 * Nest matches in declaration order.
 */
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll(
    @Query('governorateId') governorateId?: string,
    @Query('scope') scope?: string,
  ): Promise<LocationWithStats[]> {
    return this.locationsService.findAllWithStats(
      scope === 'all' ? 'all' : governorateId,
    );
  }

  @Get(':id/media')
  findMedia(@Param('id') id: string): Promise<MediaItem[]> {
    return this.locationsService.findMedia(id);
  }

  @Get(':id/before-after')
  async findBeforeAfter(
    @Param('id') id: string,
  ): Promise<{ pair: BeforeAfterPair | null; reason?: string }> {
    const pair = await this.locationsService.findBeforeAfter(id);
    return pair
      ? { pair }
      : {
          pair: null,
          reason:
            'No historical photograph of the same subject has been added for this location yet.',
        };
  }

  @Get(':id/timeline')
  findTimeline(@Param('id') id: string): Promise<TimelineEvent[]> {
    return this.locationsService.findTimeline(id);
  }

  @Get(':id/quiz')
  findQuiz(@Param('id') id: string): Promise<QuizQuestion[]> {
    return this.locationsService.findQuiz(id);
  }

  @Get(':id/related')
  findRelated(@Param('id') id: string): Promise<Location[]> {
    return this.locationsService.findRelated(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Location> {
    return this.locationsService.findOne(id);
  }
}
