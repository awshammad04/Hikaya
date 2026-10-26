import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { SessionGuard } from './session.guard';
import { ReviewerGuard } from './reviewer.guard';

@Module({
  controllers: [AuthController, MeController],
  providers: [AuthService, SessionGuard, ReviewerGuard],
  exports: [AuthService, ReviewerGuard],
})
export class AccountsModule {}
