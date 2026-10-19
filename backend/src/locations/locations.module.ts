import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService],
  // Exported so ContributionsModule and AiModule can validate a location slug
  // and read its content-file paths.
  exports: [LocationsService],
})
export class LocationsModule {}
