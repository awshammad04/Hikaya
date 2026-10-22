import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Multipart text fields arrive as strings, so consent is the string 'true'. */
export class TranscribeVoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  locationId?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  language?: string;

  @IsIn(['true'], { message: 'Consent is required before a recording is saved.' })
  consent: string;
}
