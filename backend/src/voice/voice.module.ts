import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  imports: [LocationsModule],
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
