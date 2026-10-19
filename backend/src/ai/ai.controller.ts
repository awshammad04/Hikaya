import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateStoryDto } from './dto/generate-story.dto';
import { AskGuideDto } from './dto/ask-guide.dto';
import {
  GeneratedStory,
  GuideAnswer,
} from './interfaces/generated-story.interface';

/**
 * AI endpoints.
 *
 * POST /api/v1/ai/generate-story -> narrative for a location, from reviewed content
 * POST /api/v1/ai/ask-guide      -> answer a question from the same content
 */
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-story')
  @HttpCode(200)
  generateStory(@Body() dto: GenerateStoryDto): Promise<GeneratedStory> {
    return this.aiService.generateStory(dto);
  }

  @Post('ask-guide')
  @HttpCode(200)
  askGuide(@Body() dto: AskGuideDto): Promise<GuideAnswer> {
    return this.aiService.askGuide(dto);
  }
}
