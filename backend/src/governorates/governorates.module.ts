import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { GovernoratesService } from './governorates.service';
import { GovernoratesController } from './governorates.controller';

@Module({
  imports: [LocationsModule],
  providers: [GovernoratesService],
  controllers: [GovernoratesController],
  exports: [GovernoratesService],
})
export class GovernoratesModule {}
