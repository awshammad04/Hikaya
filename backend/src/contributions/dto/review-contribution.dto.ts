import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** A reviewer's decision on one submission. */
export class ReviewContributionDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  /**
   * Shown to the contributor on their status lookup. Required when rejecting,
   * so nobody is turned down without a reason.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
