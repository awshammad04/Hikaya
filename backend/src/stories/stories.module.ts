import { Module } from '@nestjs/common';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  controllers: [StoriesController],
  providers: [StoriesService],
  // Exported so AiModule can store generated stories for review.
  exports: [StoriesService],
})
export class StoriesModule {}
