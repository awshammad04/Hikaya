import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  ProgressKind,
  SavedStoryKind,
} from '../../database/entities/account.entity';

const ITEM_ID = /^[A-Za-z0-9_:.-]{1,120}$/;
const RECORD_ID = /^[A-Za-z0-9-]{8,64}$/;
/** A calling code from the picker, e.g. +970. */
const CALLING_CODE = /^\+?[1-9]\d{0,2}$/;

/** The number itself is checked and normalized by AuthService (phone.ts). */
export class SignUpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @Matches(CALLING_CODE, { message: 'countryCode must look like +970' })
  countryCode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(200)
  password: string;
}

/** A phone number with its country code, or an older account's email. */
export class LogInDto {
  @ValidateIf((dto: LogInDto) => dto.phone === undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ValidateIf((dto: LogInDto) => dto.email === undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  phone?: string;

  @ValidateIf((dto: LogInDto) => dto.phone !== undefined)
  @Matches(CALLING_CODE, { message: 'countryCode must look like +970' })
  countryCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

/** Progress ids to add. Each list is optional; duplicates are ignored. */
export class ProgressDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @Matches(ITEM_ID, { each: true })
  visited?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @Matches(ITEM_ID, { each: true })
  quiz?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @Matches(ITEM_ID, { each: true })
  audio?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @Matches(ITEM_ID, { each: true })
  memoryUncovered?: string[];
}

export class RemoveProgressDto {
  @IsIn(['visited', 'quiz', 'audio', 'memoryUncovered'])
  kind: 'visited' | 'quiz' | 'audio' | 'memoryUncovered';

  @IsArray()
  @ArrayMaxSize(500)
  @Matches(ITEM_ID, { each: true })
  ids: string[];
}

export const PROGRESS_FIELDS: Record<
  'visited' | 'quiz' | 'audio' | 'memoryUncovered',
  ProgressKind
> = {
  visited: 'visited',
  quiz: 'quiz',
  audio: 'audio',
  memoryUncovered: 'memory_uncovered',
};

export class AddPhotoDto {
  @IsOptional()
  @Matches(RECORD_ID)
  id?: string;

  /** A JPEG, PNG or WebP data URL, already downsized by the browser. */
  @IsString()
  @MaxLength(8_000_000)
  photoDataUrl: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  locationTag: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  governorateId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  governorateIds?: string[];

  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}

export class AddStoryDto {
  @IsOptional()
  @Matches(RECORD_ID)
  id?: string;

  @IsIn(['journey', 'location_story', 'my_story'])
  kind: SavedStoryKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @Matches(ITEM_ID)
  locationId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  governorateIds?: string[];

  /** The story as the frontend renders it (a journey, a generated story or the visitor's own). */
  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  createdAt?: string;
}
