import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateJourneyDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  governorateIds: string[];
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsIn(
    ['history', 'architecture', 'religious', 'food_markets', 'oral_heritage'],
    { each: true },
  )
  interests: string[];
  @IsIn(['express', 'half_day', 'full_day', 'weekend']) duration: string;
  @IsIn(['ar', 'en']) language: string;
  @IsOptional()
  @IsIn(['student', 'tourist', 'child', 'short', 'historian', 'general'])
  targetAudience?: string;
  @IsOptional()
  @IsIn(['neutral', 'educational', 'emotional', 'storytelling'])
  tone?: string;
}
