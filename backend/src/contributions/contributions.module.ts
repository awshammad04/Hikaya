import { Module } from '@nestjs/common';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { ReviewController } from './review.controller';
import { LocationsModule } from '../locations/locations.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [LocationsModule, AccountsModule],
  controllers: [ContributionsController, ReviewController],
  providers: [ContributionsService],
})
export class ContributionsModule {}
