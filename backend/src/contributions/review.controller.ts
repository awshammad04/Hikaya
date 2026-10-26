import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ContributionsService,
  ReviewItem,
  ReviewQueue,
} from './contributions.service';
import { ReviewContributionDto } from './dto/review-contribution.dto';
import type { ContributionStatus } from '../database/entities/contribution.entity';
import type { User } from '../database/entities/account.entity';
import { CurrentUser } from '../accounts/session';
import { ReviewerGuard } from '../accounts/reviewer.guard';

const STATUSES: ContributionStatus[] = [
  'pending_review',
  'approved',
  'rejected',
];

/**
 * The review queue, for editors and admins only.
 *
 * GET  /api/v1/admin/contributions?status=pending_review -> queue + counts
 * POST /api/v1/admin/contributions/:id/review            -> approve or reject
 */
@Controller('admin/contributions')
@UseGuards(ReviewerGuard)
export class ReviewController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get()
  queue(
    @Query('status') status: string = 'pending_review',
  ): Promise<ReviewQueue> {
    if (!STATUSES.includes(status as ContributionStatus))
      throw new BadRequestException(
        `status must be one of ${STATUSES.join(', ')}`,
      );
    return this.contributionsService.listForReview(
      status as ContributionStatus,
    );
  }

  @Post(':id/review')
  @HttpCode(200)
  review(
    @Param('id') id: string,
    @Body() dto: ReviewContributionDto,
    @CurrentUser() reviewer: User,
  ): Promise<ReviewItem> {
    return this.contributionsService.review(id, dto, reviewer);
  }
}
