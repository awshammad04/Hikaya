import { Module } from '@nestjs/common';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { LocationsModule } from '../locations/locations.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [LocationsModule, AccountsModule],
  controllers: [ContributionsController],
  providers: [ContributionsService],
})
export class ContributionsModule {}
