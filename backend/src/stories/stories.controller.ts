import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { FeaturedStory, StoriesService } from './stories.service';
import { Story } from '../database/entities/story.entity';

/**
 * Stories endpoints.
 *
 * GET /api/v1/stories/featured               -> the story of the day
 * GET /api/v1/stories/random                 -> a random published story
 * GET /api/v1/stories/detail/:id             -> a single story
 * GET /api/v1/stories/location/:locationId   -> stories for a location
 * GET /api/v1/stories/:locationId            -> same, the Sprint 2 route
 *
 * Route order matters: the fixed segments are declared before the bare
 * `:locationId` parameter, otherwise Nest would match them as location slugs.
 */
@Controller('stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get('featured')
  async findFeatured(): Promise<FeaturedStory> {
    const featured = await this.storiesService.findFeatured();
    if (!featured) {
      throw new NotFoundException('No published stories are available yet');
    }
    return featured;
  }

  @Get('random')
  async findRandom(@Query('exclude') exclude?: string): Promise<FeaturedStory> {
    const random = await this.storiesService.findRandom(exclude);
    if (!random) {
      throw new NotFoundException('No published stories are available yet');
    }
    return random;
  }

  @Get('detail/:id')
  findOne(@Param('id') id: string): Promise<Story> {
    return this.storiesService.findOne(id);
  }

  @Get('location/:locationId')
  findByLocationExplicit(
    @Param('locationId') locationId: string,
  ): Promise<Story[]> {
    return this.storiesService.findByLocation(locationId);
  }

  @Get(':locationId')
  findByLocation(@Param('locationId') locationId: string): Promise<Story[]> {
    return this.storiesService.findByLocation(locationId);
  }
}
