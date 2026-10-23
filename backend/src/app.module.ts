import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { LocationsModule } from './locations/locations.module';
import { StoriesModule } from './stories/stories.module';
import { ContributionsModule } from './contributions/contributions.module';
import { AiModule } from './ai/ai.module';
import { GovernoratesModule } from './governorates/governorates.module';
import { JourneysModule } from './journeys/journeys.module';
import { AccountsModule } from './accounts/accounts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    LocationsModule,
    StoriesModule,
    ContributionsModule,
    AiModule,
    GovernoratesModule,
    JourneysModule,
    AccountsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
