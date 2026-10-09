import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const AUDIENCES = [
  'student',
  'tourist',
  'child',
  'short',
  'historian',
  'general',
] as const;
export const TONES = [
  'neutral',
  'educational',
  'emotional',
  'storytelling',
] as const;

/**
 * GenerateStoryDto
 *
 * Request from the frontend for an AI-generated narrative. Mirrors the input
 * side of ai/api-contract.md.
 *
 * Normally only `locationId` is sent: the AI module loads the reviewed summary
 * itself from content/ai-ready/, so a 20 KB document does not travel on every
 * request. `historicalText` is the escape hatch for reviewed content that is not
 * yet in the repository.
 */
export class GenerateStoryDto {
  @ValidateIf((dto: GenerateStoryDto) => !dto.historicalText)
  @IsString({ message: 'either locationId or historicalText is required' })
  locationId?: string;

  @IsOptional()
  @IsString()
  governorateId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60000)
  historicalText?: string;

  @IsOptional()
  @IsIn(AUDIENCES)
  targetAudience?: (typeof AUDIENCES)[number];

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(TONES)
  tone?: (typeof TONES)[number];

  @IsOptional()
  @IsInt()
  @Min(40)
  @Max(600)
  maxWords?: number;

  /**
   * Whether to store the generated narrative as a story awaiting review.
   * Defaults to true; the frontend sets it to false for throwaway previews.
   */
  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}
