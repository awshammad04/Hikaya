import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { IN_MEMORY_REPOSITORY_PROVIDERS } from '../testing/in-memory-providers';

describe('LocationsService', () => {
  let service: LocationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocationsService, ...IN_MEMORY_REPOSITORY_PROVIDERS],
    }).compile();

    service = module.get(LocationsService);
  });

  it('returns the eight seeded Jerusalem locations', async () => {
    const locations = await service.findAll();
    expect(locations.map((location) => location.id).sort()).toEqual([
      'armenian-quarter',
      'at-tur',
      'bab-al-amud',
      'christian-quarter',
      'maghariba-quarter',
      'muslim-quarter',
      'sheikh-jarrah',
      'silwan',
    ]);
  });

  it('returns real seeded data, not placeholders', async () => {
    const quarter = await service.findOne('muslim-quarter');
    expect(quarter.name).toBe('Muslim Quarter');
    expect(quarter.latitude).toBeCloseTo(31.7806);
    expect(quarter.longitude).toBeCloseTo(35.2339);
    expect(quarter.description).toContain('Mamluk');
    expect(quarter.categories.length).toBeGreaterThan(0);
  });

  it('points every location at its reviewed content files', async () => {
    for (const location of await service.findAll()) {
      expect(location.contentFile).toMatch(/^content\//);
      expect(location.aiSummaryFile).toMatch(/^content\/ai-ready\//);
    }
  });

  it('throws 404 for an unknown location', async () => {
    await expect(service.findOne('atlantis')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('summary counts', () => {
    it('reports stories, images, timeline entries and memories per location', async () => {
      const locations = await service.findAllWithStats();
      const location = locations.find(
        (item) => item.id === 'muslim-quarter',
      );

      expect(location?.stats.storyCount).toBe(1);
      expect(location?.stats.imageCount).toBeGreaterThan(0);
      expect(location?.stats.timelineEventCount).toBeGreaterThan(0);
      expect(location?.stats.memoryCount).toBe(2);
    });

    it('estimates a reading time of at least a minute where there is a story', async () => {
      for (const location of await service.findAllWithStats()) {
        expect(location.stats.readingTimeMinutes).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('media', () => {
    it('returns gallery images carrying credit and licence', async () => {
      const media = await service.findMedia('bab-al-amud');
      expect(media.length).toBeGreaterThan(0);
      for (const item of media) {
        expect(item.credit).toBeTruthy();
        expect(item.license).toBeTruthy();
        expect(item.sourceUrl).toContain('commons.wikimedia.org');
      }
    });

    it('pairs a historical and a present-day photo of the same subject', async () => {
      const pair = await service.findBeforeAfter('bab-al-amud');
      expect(pair).not.toBeNull();
      expect(pair?.before.era).toBe('historical');
      expect(pair?.after.era).toBe('modern');
      expect(pair?.before.subject).toBe(pair?.after.subject);
    });

    it('returns no pair where there is no matching historical photo', async () => {
      expect(await service.findBeforeAfter('silwan')).toBeNull();
    });
  });

  describe('timeline', () => {
    it('returns the events in the order the content file gives them', async () => {
      const timeline = await service.findTimeline('bab-al-amud');
      expect(timeline.length).toBeGreaterThan(2);
      expect(timeline.map((event) => event.sortOrder)).toEqual(
        [...timeline.map((event) => event.sortOrder)].sort((a, b) => a - b),
      );
      expect(timeline[0].periodLabel).toContain('Roman');
    });

    it('flags entries that rest on tradition rather than documented history', async () => {
      const timeline = await service.findTimeline('bab-al-amud');
      const traditions = timeline.filter((event) => event.isTradition);
      expect(traditions.length).toBeGreaterThan(0);
      expect(
        traditions.some((event) => /believed/.test(event.description)),
      ).toBe(true);
    });

    it('cites the content file every event came from', async () => {
      for (const event of await service.findTimeline('muslim-quarter')) {
        expect(event.sourceFile).toBe('content/ai-ready/muslim-quarter-summary.md');
      }
    });
  });

  describe('quiz', () => {
    it('returns answerable questions that cite their source', async () => {
      const questions = await service.findQuiz('muslim-quarter');
      expect(questions.length).toBeGreaterThan(0);
      for (const question of questions) {
        expect(question.options.length).toBeGreaterThanOrEqual(2);
        expect(question.answerIndex).toBeGreaterThanOrEqual(0);
        expect(question.answerIndex).toBeLessThan(question.options.length);
        expect(question.explanation).toBeTruthy();
        expect(question.sourceNote).toBeTruthy();
      }
    });
  });

  describe('related locations', () => {
    it('suggests other locations that share a category, excluding itself', async () => {
      const related = await service.findRelated('muslim-quarter');
      expect(related.length).toBeGreaterThan(0);
      expect(related.map((location) => location.id)).not.toContain('muslim-quarter');
    });

    it('throws 404 for an unknown location', async () => {
      await expect(service.findRelated('atlantis')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
