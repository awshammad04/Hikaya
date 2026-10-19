import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import {
  CONTRIBUTIONS_REPOSITORY,
  LOCATIONS_REPOSITORY,
  MEDIA_REPOSITORY,
  QUIZ_REPOSITORY,
  STORIES_REPOSITORY,
  TIMELINE_REPOSITORY,
} from './repositories/tokens';
import {
  InMemoryLocationsRepository,
  PostgresLocationsRepository,
} from './repositories/locations.repository';
import {
  InMemoryStoriesRepository,
  PostgresStoriesRepository,
} from './repositories/stories.repository';
import {
  InMemoryContributionsRepository,
  PostgresContributionsRepository,
} from './repositories/contributions.repository';
import {
  InMemoryMediaRepository,
  PostgresMediaRepository,
} from './repositories/media.repository';
import {
  InMemoryTimelineRepository,
  PostgresTimelineRepository,
} from './repositories/timeline.repository';
import {
  InMemoryQuizRepository,
  PostgresQuizRepository,
} from './repositories/quiz.repository';

/**
 * DatabaseModule
 *
 * Connects to PostgreSQL at boot and picks the repository implementation to
 * match. If DATABASE_URL is unset or unreachable, every repository falls back
 * to the in-memory seed, so the API keeps working with real data instead of
 * failing to start. The choice is made once, here - no service downstream has
 * to know which one it got.
 *
 * The DatabaseService factory is async so the connection probe completes before
 * the repository factories run.
 */
@Global()
@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: async (config: ConfigService): Promise<DatabaseService> => {
        const service = new DatabaseService();
        await service.connect(config.get<string>('DATABASE_URL'));
        return service;
      },
      inject: [ConfigService],
    },
    {
      provide: LOCATIONS_REPOSITORY,
      useFactory: (db: DatabaseService) =>
        db.isAvailable()
          ? new PostgresLocationsRepository(db)
          : new InMemoryLocationsRepository(),
      inject: [DatabaseService],
    },
    {
      provide: STORIES_REPOSITORY,
      useFactory: (db: DatabaseService) =>
        db.isAvailable()
          ? new PostgresStoriesRepository(db)
          : new InMemoryStoriesRepository(),
      inject: [DatabaseService],
    },
    {
      provide: CONTRIBUTIONS_REPOSITORY,
      useFactory: (db: DatabaseService) =>
        db.isAvailable()
          ? new PostgresContributionsRepository(db)
          : new InMemoryContributionsRepository(),
      inject: [DatabaseService],
    },
    {
      provide: MEDIA_REPOSITORY,
      useFactory: (db: DatabaseService) =>
        db.isAvailable()
          ? new PostgresMediaRepository(db)
          : new InMemoryMediaRepository(),
      inject: [DatabaseService],
    },
    {
      provide: TIMELINE_REPOSITORY,
      useFactory: (db: DatabaseService) =>
        db.isAvailable()
          ? new PostgresTimelineRepository(db)
          : new InMemoryTimelineRepository(),
      inject: [DatabaseService],
    },
    {
      provide: QUIZ_REPOSITORY,
      useFactory: (db: DatabaseService) =>
        db.isAvailable()
          ? new PostgresQuizRepository(db)
          : new InMemoryQuizRepository(),
      inject: [DatabaseService],
    },
  ],
  exports: [
    DatabaseService,
    LOCATIONS_REPOSITORY,
    STORIES_REPOSITORY,
    CONTRIBUTIONS_REPOSITORY,
    MEDIA_REPOSITORY,
    TIMELINE_REPOSITORY,
    QUIZ_REPOSITORY,
  ],
})
export class DatabaseModule {}
