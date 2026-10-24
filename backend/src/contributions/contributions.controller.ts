import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ContributionsService,
  ContributionStatusView,
} from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { Contribution } from '../database/entities/contribution.entity';
import { AuthService } from '../accounts/auth.service';
import { readCookie, SESSION_COOKIE } from '../accounts/session';

/**
 * Contributions endpoints.
 *
 * POST /api/v1/contributions               -> submit a contribution for review
 * GET  /api/v1/contributions               -> approved contributions
 * GET  /api/v1/contributions?locationId=x  -> approved contributions for one location
 * GET  /api/v1/contributions/status/:code  -> review status by reference code
 */
@Controller('contributions')
export class ContributionsController {
  constructor(
    private readonly contributionsService: ContributionsService,
    private readonly auth: AuthService,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body() dto: CreateContributionDto,
    @Req() req: Request,
  ): Promise<{
    status: string;
    message: string;
    referenceCode?: string;
    contribution: Contribution;
  }> {
    // Signed-in contributors see the submission on their profile; guests keep
    // using the reference code.
    const user = await this.auth.userForToken(readCookie(req, SESSION_COOKIE));
    const contribution = await this.contributionsService.create(
      dto,
      user?.id ?? null,
    );
    return {
      status: 'pending_review',
      message:
        'Thank you - your memory was received and is waiting for review before it is published. Keep the reference code below if you want to check on it later.',
      referenceCode: contribution.referenceCode,
      contribution,
    };
  }

  @Get('status/:code')
  findStatus(@Param('code') code: string): Promise<ContributionStatusView> {
    return this.contributionsService.findStatus(code);
  }

  @Get()
  findApproved(
    @Query('locationId') locationId?: string,
  ): Promise<Contribution[]> {
    return locationId
      ? this.contributionsService.findApprovedByLocation(locationId)
      : this.contributionsService.findApproved();
  }
}
