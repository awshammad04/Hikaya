import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { GovernoratesService } from '../governorates/governorates.service';
import { LocationsService } from '../locations/locations.service';
import { AiService } from '../ai/ai.service';
import { catalog } from '../database/seed/palestine-data';
import { CreateJourneyDto } from './create-journey.dto';
import { GenerateStoryDto } from '../ai/dto/generate-story.dto';

const CATEGORY_INTERESTS: Record<string, string[]> = {
  'حارة تاريخية': ['history', 'architecture'],
  'معلم ديني': ['religious', 'architecture', 'history'],
  'سوق تراثي': ['food_markets', 'history'],
  'حي مقدسي': ['oral_heritage', 'history'],
  متحف: ['history'],
  'تراث ثقافي': ['architecture', 'history'],
};

@Injectable()
export class JourneysService {
  constructor(
    private readonly governors: GovernoratesService,
    private readonly locations: LocationsService,
    private readonly ai: AiService,
  ) {}

  async create(dto: CreateJourneyDto) {
    const ids = [...new Set(dto.governorateIds)];
    const allGov = await this.governors.findAll();
    if (!ids.length || ids.some((id) => !allGov.some((item) => item.id === id)))
      throw new BadRequestException('Choose valid governorates.');
    const all = await this.locations.findAll('all');
    const pools = ids.map((id) =>
      all
        .filter((item) => item.governorateId === id)
        .map((location) => {
          const record = catalog.locations.find(
            (item) => item.id === location.id,
          );
          const interests = record?.interests ?? [
            ...new Set(
              location.categories.flatMap(
                (category) => CATEGORY_INTERESTS[category] ?? [],
              ),
            ),
          ];
          return {
            location,
            matchedInterests: dto.interests.filter((interest) =>
              interests.includes(interest),
            ),
          };
        })
        .sort(
          (a, b) =>
            b.matchedInterests.length - a.matchedInterests.length ||
            a.location.id.localeCompare(b.location.id),
        ),
    );
    // Round-robin gives each selected governorate representation even on a short journey.
    const count = Math.max(
      ids.length,
      { express: 3, half_day: 5, full_day: 7, weekend: 14 }[dto.duration] ?? 5,
    );
    const selected: (typeof pools)[number] = [];
    while (selected.length < count && pools.some((pool) => pool.length)) {
      for (const pool of pools) {
        if (selected.length >= count) break;
        const item = pool.shift();
        if (item) selected.push(item);
      }
    }
    const stops = await Promise.all(
      selected.map(async ({ location, matchedInterests }, index) => {
        const record = catalog.locations.find(
          (item) => item.id === location.id,
        );
        const narrative = await this.ai.generateStory({
          locationId: location.id,
          governorateId: location.governorateId,
          language: dto.language,
          targetAudience: dto.targetAudience ?? 'general',
          tone: dto.tone ?? 'storytelling',
          persist: false,
        } as GenerateStoryDto);
        return {
          order: index + 1,
          location,
          matchedInterests,
          narrative,
          sourceLinks: record?.sources ?? [],
          resources: {
            story: `/locations/${location.id}`,
            timeline: `/locations/${location.id}?tab=timeline`,
            gallery: `/locations/${location.id}?tab=gallery`,
            quiz: `/locations/${location.id}?tab=quiz`,
            guide: `/locations/${location.id}?ask=1`,
            contribute: `/contribute?location=${location.id}`,
          },
        };
      }),
    );
    const names = ids
      .map((id) => allGov.find((item) => item.id === id)!)
      .map((item) => (dto.language === 'ar' ? item.arabicName : item.name));
    const title =
      dto.language === 'ar'
        ? `حكايتي: ${names.join(' · ')}`
        : `My story: ${names.join(' · ')}`;
    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      title,
      mode: 'cultural',
      preferences: dto,
      governorateIds: ids,
      stops,
      narrative: stops
        .map(
          (stop) =>
            `${stop.order}. ${stop.narrative.title}\n${stop.narrative.narrative}`,
        )
        .join('\n\n'),
      uncertaintyNotes: [
        dto.language === 'ar' ? catalog.gaps.ar : catalog.gaps.en,
        ...ids
          .filter(
            (id) => !stops.some((stop) => stop.location.governorateId === id),
          )
          .map((id) => `No published places available for ${id}.`),
      ],
      reviewStatus: 'generated_not_editorially_approved',
    };
  }
}
