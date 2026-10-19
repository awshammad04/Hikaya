import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StoriesService } from './stories.service';
import { IN_MEMORY_REPOSITORY_PROVIDERS } from '../testing/in-memory-providers';

describe('StoriesService', () => {
  let service: StoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoriesService, ...IN_MEMORY_REPOSITORY_PROVIDERS],
    }).compile();

    service = module.get(StoriesService);
  });

  it('returns the seeded story for each MVP location', async () => {
    for (const locationId of ['muslim-quarter', 'christian-quarter', 'bab-al-amud']) {
      const stories = await service.findByLocation(locationId);
      expect(stories).toHaveLength(1);
      expect(stories[0].simplifiedStory.length).toBeGreaterThan(150);
      expect(stories[0].status).toBe('published');
    }
  });

  it('returns nothing for a location with no stories', async () => {
    expect(await service.findByLocation('atlantis')).toEqual([]);
  });

  it('throws 404 for an unknown story id', async () => {
    await expect(service.findOne('no-such-story')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('keeps newly created stories out of the published results', async () => {
    const created = await service.create({
      locationId: 'muslim-quarter',
      authorId: null,
      title: 'Generated story',
      summary: 'A generated summary.',
      simplifiedStory: 'A generated narrative.',
      audience: 'student',
      language: 'en',
      tone: 'storytelling',
      isAiGenerated: true,
      uncertaintyNotes: ['a gap the source did not cover'],
      status: 'pending_review',
    });

    expect(created.id).toBeTruthy();
    expect(await service.findOne(created.id)).toMatchObject({
      status: 'pending_review',
      isAiGenerated: true,
    });

    const published = await service.findByLocation('muslim-quarter');
    expect(published.map((story) => story.id)).not.toContain(created.id);
  });

  describe('featured and random', () => {
    it('picks the same story of the day for a given date, and a different one later', async () => {
      const monday = new Date('2026-08-10T09:00:00Z');
      const first = await service.findFeatured(monday);
      const again = await service.findFeatured(
        new Date('2026-08-10T21:00:00Z'),
      );

      expect(first?.story.id).toBe(again?.story.id);
      expect(first?.reason).toBe('daily-rotation');
      expect(first?.forDate).toBe('2026-08-10');
      expect(first?.location?.id).toBe(first?.story.locationId);

      // Over a run of days the rotation must actually move.
      const across = await Promise.all(
        [0, 1, 2, 3].map((offset) =>
          service.findFeatured(new Date(2026, 7, 10 + offset, 9)),
        ),
      );
      expect(
        new Set(across.map((entry) => entry?.story.id)).size,
      ).toBeGreaterThan(1);
    });

    it('returns a random published story, avoiding the one already on screen', async () => {
      const random = await service.findRandom('story-muslim-quarter');
      expect(random).not.toBeNull();
      expect(random?.story.id).not.toBe('story-muslim-quarter');
      expect(random?.reason).toBe('random');
    });

    it('never features a story that is not published', async () => {
      await service.create({
        locationId: 'muslim-quarter',
        authorId: null,
        title: 'Draft story',
        simplifiedStory: 'Not for readers yet.',
        audience: 'student',
        language: 'en',
        tone: 'storytelling',
        isAiGenerated: true,
        uncertaintyNotes: [],
        status: 'pending_review',
      });

      const seen = await Promise.all(
        Array.from({ length: 12 }, () => service.findRandom()),
      );
      for (const entry of seen) {
        expect(entry?.story.status).toBe('published');
      }
    });
  });
});
