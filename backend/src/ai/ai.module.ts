import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LocationsModule } from '../locations/locations.module';
import { StoriesModule } from '../stories/stories.module';
import { aiServiceUrl } from '../production';

/**
 * AiModule
 *
 * Talks to the AI module in ai/ over HTTP (see ai/api-contract.md). The AI
 * service owns content loading and the no-invention rules; this module only
 * calls it, falls back locally when it is unreachable, and files the result for
 * review.
 */
@Module({
  imports: [
    LocationsModule,
    StoriesModule,
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Generation is slower than a normal request, so the timeout is generous.
        timeout: Number(config.get<string>('AI_SERVICE_TIMEOUT_MS') ?? 150000),
        baseURL: aiServiceUrl(),
        headers: {
          'x-hikaya-ai-token': config.get<string>('AI_INTERNAL_TOKEN') ?? '',
        },
      }),
    }),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
