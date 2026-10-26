import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JourneysService } from './journeys.service';
import { GovernoratesService } from '../governorates/governorates.service';
import { LocationsService } from '../locations/locations.service';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { IN_MEMORY_REPOSITORY_PROVIDERS } from '../testing/in-memory-providers';
import { GenerateStoryDto } from '../ai/dto/generate-story.dto';
import { CreateJourneyDto } from './create-journey.dto';
import { catalog } from '../database/seed/palestine-data';

const placesIn = (id: string) =>
  catalog.locations.filter((item) => item.governorateId === id).length;

describe('Governorate journeys', () => {
  let service: JourneysService;
  let locations: LocationsService;
  const preferences: CreateJourneyDto = {
    governorateIds: ['ramallah', 'hebron', 'gaza'],
    interests: ['history', 'architecture'],
    language: 'en',
    duration: 'express',
  };
  const ai = {
    generateStory: jest.fn((dto: GenerateStoryDto) =>
      Promise.resolve({
        title: dto.locationId,
        narrative: `Source record for ${dto.locationId}`,
        summary: dto.locationId,
        source: { locationId: dto.locationId },
        uncertaintyNotes: [],
      }),
    ),
  };
  beforeEach(async () => {
    ai.generateStory.mockClear();
    const module = await Test.createTestingModule({
      providers: [
        JourneysService,
        GovernoratesService,
        LocationsService,
        ...IN_MEMORY_REPOSITORY_PROVIDERS,
        { provide: DatabaseService, useValue: { isAvailable: () => false } },
        { provide: AiService, useValue: ai },
      ],
    }).compile();
    service = module.get(JourneysService);
    locations = module.get(LocationsService);
  });
  it('preserves the legacy eight-location collection', async () => {
    expect((await locations.findAll()).length).toBe(8);
    expect((await locations.findAll('all')).length).toBe(26);
  });
  it.each(['ramallah', 'nablus', 'jericho', 'bethlehem', 'hebron', 'gaza'])(
    'restricts %s journeys to that governorate',
    async (id) => {
      const journey = await service.create({
        ...preferences,
        governorateIds: [id],
      });
      // An express journey holds at most three stops.
      expect(journey.stops).toHaveLength(Math.min(placesIn(id), 3));
      expect(
        journey.stops.every((stop) => stop.location.governorateId === id),
      ).toBe(true);
      expect(
        ai.generateStory.mock.calls.every(
          ([dto]) => dto.governorateId === id && dto.persist === false,
        ),
      ).toBe(true);
    },
  );
  it('represents every selected governorate in a short integrated journey', async () => {
    const journey = await service.create({
      ...preferences,
      governorateIds: ['jerusalem', ...preferences.governorateIds],
    });
    expect(
      new Set(journey.stops.map((stop) => stop.location.governorateId)),
    ).toEqual(new Set(journey.governorateIds));
    expect(journey.narrative).toContain('Source record');
    expect(journey.mode).toBe('cultural');
    expect(journey).not.toHaveProperty('totalWalkingMinutes');
    expect(
      journey.stops.every((stop) =>
        stop.resources.guide.includes(stop.location.id),
      ),
    ).toBe(true);
  });
  it('rejects unknown governorates', async () => {
    await expect(
      service.create({ ...preferences, governorateIds: ['unknown'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ai.generateStory).not.toHaveBeenCalled();
  });
  it('does not introduce new related places into Jerusalem relationships', async () => {
    expect(
      (await locations.findRelated('muslim-quarter')).every(
        (item) => item.governorateId === 'jerusalem',
      ),
    ).toBe(true);
    const gaza = await locations.findRelated('gaza-omari-mosque');
    expect(gaza.map((item) => item.id)).toContain('gaza-porphyrius-church');
    expect(gaza.every((item) => item.governorateId === 'gaza')).toBe(true);
  });
});
