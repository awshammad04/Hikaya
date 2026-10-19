import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * CreateContributionDto
 *
 * Payload for the public contribution form: a memory, story or photo tied to a
 * location. Field names and limits follow the `contributions` table in
 * database/schema.sql.
 *
 * No account is required, so `contributorName` and `contributorEmail` are the
 * only identity fields, and both are optional.
 */
export class CreateContributionDto {
  /** Location slug, e.g. 'jerusalem'. Must be an existing location. */
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(20, {
    message:
      'content is too short - please share at least a couple of sentences',
  })
  @MaxLength(10000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contributorName?: string;

  @IsOptional()
  @IsEmail()
  contributorEmail?: string;

  /**
   * Link to a photograph, recording or video that belongs with the memory.
   *
   * A URL rather than an upload: Hikaya has no file storage yet, and accepting
   * uploads it cannot keep would lose people's material. See the gaps section
   * of docs/sprint-2-report.md.
   */
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @IsOptional()
  @IsIn(['image', 'audio', 'video'])
  mediaType?: 'image' | 'audio' | 'video';

  @IsOptional()
  @IsString()
  categoryId?: string;
}
