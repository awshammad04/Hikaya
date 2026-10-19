import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * One earlier turn of the same conversation.
 *
 * Sent back so a follow-up ("and when was that?") can be resolved against what
 * was just discussed. The AI module treats it as context for understanding the
 * question, never as a source of facts - answers still come only from the
 * reviewed content.
 */
export class ChatTurnDto {
  @IsString()
  @MaxLength(1000)
  question: string;

  @IsString()
  @MaxLength(4000)
  answer: string;
}

/**
 * AskGuideDto
 *
 * Request payload for the conversational "ask the guide" AI feature, where a
 * user asks a free-form question about a location.
 */
export class AskGuideDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  governorateIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  locationIds?: string[];

  @IsOptional()
  @IsString()
  language?: string;

  /**
   * The conversation so far, oldest first. Capped so a caller cannot grow the
   * prompt without bound.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChatTurnDto)
  history?: ChatTurnDto[];
}
