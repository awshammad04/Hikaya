import { Module } from '@nestjs/common';
import { GovernoratesModule } from '../governorates/governorates.module';
import { LocationsModule } from '../locations/locations.module';
import { AiModule } from '../ai/ai.module';
import { JourneysController } from './journeys.controller';
import { JourneysService } from './journeys.service';
@Module({
  imports: [GovernoratesModule, LocationsModule, AiModule],
  providers: [JourneysService],
  controllers: [JourneysController],
})
export class JourneysModule {}
