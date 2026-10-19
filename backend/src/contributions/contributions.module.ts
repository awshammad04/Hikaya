import { Module } from '@nestjs/common';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { LocationsModule } from '../locations/locations.module';

@Module({
  imports: [LocationsModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
})
export class ContributionsModule {}
