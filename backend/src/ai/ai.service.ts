import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { AskGuideDto } from './dto/ask-guide.dto';
import { GenerateStoryDto } from './dto/generate-story.dto';
import {
  AiGuideResponse,
  AiStoryResponse,
  GeneratedStory,
  GuideAnswer,
} from './interfaces/generated-story.interface';
import { Location } from '../database/entities/location.entity';
import { LocationsService } from '../locations/locations.service';
import { StoriesService } from '../stories/stories.service';
import { catalog } from '../database/seed/palestine-data';

const SCOPE_ERRORS = new Set([
  'invalid_scope',
  'content_not_reviewed',
  'unreviewed_content',
  'unknown_location',
  'missing_content',
]);

/**
 * AiService
 *
 * Client for the AI module in ai/ (see ai/api-contract.md). Responsibilities:
 *
 *  1. resolve the location so the response carries real provenance;
 *  2. call the AI service over HTTP;
 *  3. fall back to a local simplifier if that service is unreachable, so the
 *     user still gets a narrative;
 *  4. store the result as a story with status `pending_review`.
 *
 * Generated stories are never published automatically. They land in the review
 * queue, which is the same rule the content workflow applies to everything else.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly locationsService: LocationsService,
    private readonly storiesService: StoriesService,
  ) {}

  async generateStory(dto: GenerateStoryDto): Promise<GeneratedStory> {
    const location = dto.locationId
      ? await this.locationsService.findOne(dto.locationId)
      : null;
    const scopedGovernorate =
      dto.governorateId ??
      (location?.governorateId !== 'jerusalem'
        ? location?.governorateId
        : undefined);

    if (
      location &&
      dto.governorateId &&
      (location.governorateId ?? 'jerusalem') !== dto.governorateId
    )
      throw new BadRequestException(
        'Location is outside the requested governorate.',
      );
    if (scopedGovernorate && dto.historicalText)
      throw new BadRequestException(
        'Scoped requests must use the stored reviewed record.',
      );
    if (
      location?.reviewStatus &&
      !['legacy_reviewed', 'source_checked'].includes(location.reviewStatus)
    )
      throw new BadRequestException('Content is awaiting review.');
    const audience = dto.targetAudience ?? 'general';
    const tone = dto.tone ?? 'storytelling';
    const language = dto.language ?? 'en';

    let story: GeneratedStory;
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<AiStoryResponse>('/generate-story', {
          location_id: dto.locationId,
          governorate_id: scopedGovernorate,
          location_name:
            location?.governorateId &&
            location.governorateId !== 'jerusalem' &&
            language === 'ar'
              ? location.arabicName
              : location?.name,
          historical_text: dto.historicalText,
          target_audience: audience,
          language,
          tone,
          max_words: dto.maxWords,
          is_reviewed: true,
        }),
      );

      if (data.status === 'error' || !data.narrative) {
        if (scopedGovernorate && SCOPE_ERRORS.has(data.error?.code ?? '')) {
          throw new BadRequestException(
            data.error?.message ??
              'No reviewed content is available for this scope.',
          );
        }
        throw new Error(
          data.error?.message ?? 'AI service returned no narrative',
        );
      }
      story = this.toGeneratedStory(data);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const rejection = (
        error as {
          response?: { data?: { error?: { code?: string; message?: string } } };
        }
      )?.response?.data?.error;
      if (scopedGovernorate && SCOPE_ERRORS.has(rejection?.code ?? ''))
        throw new BadRequestException(
          rejection?.message ??
            'No reviewed content is available for this scope.',
        );
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `AI service unavailable (${message}) - using the local fallback simplifier.`,
      );
      if (!location) {
        // Without a known location there is nothing local to fall back to.
        throw new ServiceUnavailableException(
          'The AI service is unavailable and no location was given to fall back on.',
        );
      }
      story = this.localFallback(location, audience, language, tone);
    }

    if (dto.persist !== false && location) {
      story.storyId = await this.persist(story, location);
    }
    return story;
  }

  async askGuide(dto: AskGuideDto): Promise<GuideAnswer> {
    let scopedRequest = Boolean(
      dto.governorateIds?.length || dto.locationIds?.length,
    );
    const requestedIds = dto.locationId ? [dto.locationId] : dto.locationIds;
    if (!requestedIds?.length && !dto.governorateIds?.length)
      throw new BadRequestException('Choose locations or governorates.');
    const knownGovs = new Set(catalog.governorates.map((item) => item.id));
    if (dto.governorateIds?.some((id) => !knownGovs.has(id)))
      throw new BadRequestException('Unknown governorate.');
    if (requestedIds)
      for (const id of requestedIds) {
        const location = await this.locationsService.findOne(id);
        if (location.governorateId && location.governorateId !== 'jerusalem')
          scopedRequest = true;
        if (
          dto.governorateIds?.length &&
          !dto.governorateIds.includes(location.governorateId ?? 'jerusalem')
        )
          throw new BadRequestException(
            'Location is outside the requested governorates.',
          );
        if (
          location.reviewStatus &&
          !['legacy_reviewed', 'source_checked'].includes(location.reviewStatus)
        )
          throw new BadRequestException('Content is awaiting review.');
      }
    try {
      const { data } = await firstValueFrom(
        this.httpService.post<AiGuideResponse>('/ask-guide', {
          question: dto.question,
          governorate_ids: dto.governorateIds,
          location_ids: dto.locationIds,
          location_id: dto.locationId,
          language: dto.language ?? 'en',
          // Without this a follow-up like "and when?" has no keywords of its
          // own and the guide correctly, but uselessly, refuses to answer.
          history: dto.history ?? [],
        }),
      );
      if (data.status === 'error' || typeof data.answer !== 'string') {
        if (scopedRequest && SCOPE_ERRORS.has(data.error?.code ?? ''))
          throw new BadRequestException(
            data.error?.message ??
              'No reviewed content is available for this scope.',
          );
        throw new Error(
          data.error?.message ?? 'AI service returned no guide answer',
        );
      }
      return {
        answer: data.answer,
        answeredFromSource: data.answered_from_source,
        excerpts: data.excerpts ?? [],
        uncertaintyNotes: data.uncertainty_notes ?? [],
        generatedBy: data.model?.provider ?? 'unknown',
        sources: data.sources,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const rejection = (
        error as {
          response?: { data?: { error?: { code?: string; message?: string } } };
        }
      )?.response?.data?.error;
      if (scopedRequest && SCOPE_ERRORS.has(rejection?.code ?? ''))
        throw new BadRequestException(
          rejection?.message ??
            'No reviewed content is available for this scope.',
        );
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI service unavailable for ask-guide (${message}).`);
      return {
        answer:
          'The heritage guide is temporarily unavailable. The reviewed content for this location is still readable on the location page.',
        answeredFromSource: false,
        excerpts: [],
        uncertaintyNotes: ['The AI service could not be reached.'],
        generatedBy: 'backend-fallback',
      };
    }
  }

  private toGeneratedStory(data: AiStoryResponse): GeneratedStory {
    return {
      title: data.title,
      summary: data.summary,
      narrative: data.narrative,
      targetAudience: data.target_audience,
      language: data.language,
      tone: data.tone,
      wordCount: data.word_count,
      uncertaintyNotes: data.uncertainty_notes ?? [],
      warnings: data.warnings ?? [],
      source: {
        locationId: data.source?.location_id,
        locationName: data.source?.location_name,
        contentFile: data.source?.content_file,
        summaryFile: data.source?.summary_file,
      },
      generatedBy: data.model?.provider ?? 'unknown',
    };
  }

  /**
   * Last-resort narrative built from the seeded location description alone.
   *
   * It adds no facts - it only reuses the description already stored for the
   * location - and it says plainly in the uncertainty notes that the AI service
   * was not reached, so nobody mistakes it for a generated story.
   */
  private localFallback(
    location: Location,
    audience: string,
    language: string,
    tone: string,
  ): GeneratedStory {
    const record = catalog.locations.find((item) => item.id === location.id);
    const description = record
      ? language === 'ar'
        ? `${record.arabicDescription} ${record.arabicFacts}`
        : `${record.description} ${record.facts}`
      : (location.description ?? '');
    const narrative = [
      `${location.name}${location.arabicName ? ` (${location.arabicName})` : ''}`,
      '',
      description,
      '',
      record && language === 'ar'
        ? 'يعرض هذا النص البديل السجل الموثق لهذا المكان؛ تظهر المراجع في لوحة المصادر.'
        : 'This fallback uses the stored, reviewed Palestinian heritage record for this location; the bibliography is shown in the source panel below.',
    ].join('\n');

    return {
      title:
        language === 'ar'
          ? (location.arabicName ?? location.name)
          : location.name,
      summary: description.split('. ')[0] ?? location.name,
      narrative,
      targetAudience: audience,
      language,
      tone,
      wordCount: narrative.split(/\s+/).filter(Boolean).length,
      uncertaintyNotes: [
        record && language === 'ar'
          ? 'تعذر الوصول إلى خدمة الذكاء الاصطناعي؛ يعرض هذا النص وصف المكان المحفوظ في السجل.'
          : 'The AI service could not be reached, so this text is the stored location description rather than a generated narrative.',
      ],
      warnings: [],
      source: {
        locationId: location.id,
        locationName: location.name,
        contentFile: location.contentFile,
        summaryFile: location.aiSummaryFile,
      },
      generatedBy: 'backend-fallback',
    };
  }

  private async persist(
    story: GeneratedStory,
    location: Location,
  ): Promise<string | undefined> {
    try {
      const saved = await this.storiesService.create({
        locationId: location.id,
        authorId: null,
        title: story.title,
        summary: story.summary,
        originalContent: story.source.summaryFile ?? location.aiSummaryFile,
        simplifiedStory: story.narrative,
        audience: story.targetAudience,
        language: story.language,
        tone: story.tone,
        source: location.contentFile,
        isAiGenerated: true,
        uncertaintyNotes: story.uncertaintyNotes,
        // Generated stories go to the review queue, never straight to published.
        status: 'pending_review',
      });
      return saved.id;
    } catch (error) {
      // Storing is a bonus; failing to store must not fail the request.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Could not store the generated story: ${message}`);
      return undefined;
    }
  }
}
