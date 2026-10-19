import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { AiService } from './ai.service';
import { LocationsService } from '../locations/locations.service';
import { StoriesService } from '../stories/stories.service';
import { IN_MEMORY_REPOSITORY_PROVIDERS } from '../testing/in-memory-providers';

/** A successful response body from the AI module, per ai/api-contract.md. */
const aiResponse = {
  status: 'ok',
  title: 'Visiting the Muslim Quarter',
  summary: 'The Muslim Quarter is a living historic quarter of Jerusalem.',
  narrative: 'The Muslim Quarter is a living historic quarter of Jerusalem...',
  target_audience: 'tourist',
  language: 'en',
  tone: 'storytelling',
  word_count: 292,
  uncertainty_notes: [
    'Gaps the AI must not fill: current population figures...',
  ],
  warnings: [],
  source: {
    location_id: 'muslim-quarter',
    location_name: 'Muslim Quarter',
    content_file: 'content/ai-ready/muslim-quarter-summary.md',
    summary_file: 'content/ai-ready/muslim-quarter-summary.md',
    provided_inline: false,
  },
  model: { provider: 'offline-extractive', name: 'hikaya-extractive-v1' },
  error: null,
};

describe('AiService', () => {
  let service: AiService;
  let storiesService: StoriesService;
  let post: jest.Mock;

  beforeEach(async () => {
    post = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        LocationsService,
        StoriesService,
        { provide: HttpService, useValue: { post } },
        ...IN_MEMORY_REPOSITORY_PROVIDERS,
      ],
    }).compile();

    service = module.get(AiService);
    storiesService = module.get(StoriesService);
  });

  it('returns the narrative and provenance from the AI module', async () => {
    post.mockReturnValue(of({ data: aiResponse }));

    const story = await service.generateStory({
      locationId: 'muslim-quarter',
      targetAudience: 'tourist',
    });

    expect(story.narrative).toContain('Muslim Quarter');
    expect(story.generatedBy).toBe('offline-extractive');
    expect(story.source.contentFile).toBe('content/ai-ready/muslim-quarter-summary.md');
    expect(story.uncertaintyNotes).toHaveLength(1);
  });

  it('sends the location slug rather than the content itself', async () => {
    post.mockReturnValue(of({ data: aiResponse }));
    await service.generateStory({
      locationId: 'muslim-quarter',
      targetAudience: 'tourist',
    });

    const [path, body] = post.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(path).toBe('/generate-story');
    expect(body.location_id).toBe('muslim-quarter');
    expect(body.is_reviewed).toBe(true);
    expect(body.historical_text).toBeUndefined();
  });

  it('files the generated story for review instead of publishing it', async () => {
    post.mockReturnValue(of({ data: aiResponse }));
    const story = await service.generateStory({ locationId: 'muslim-quarter' });

    expect(story.storyId).toBeTruthy();
    const stored = await storiesService.findOne(story.storyId as string);
    expect(stored.status).toBe('pending_review');
    expect(stored.isAiGenerated).toBe(true);

    const published = await storiesService.findByLocation('muslim-quarter');
    expect(published.map((item) => item.id)).not.toContain(story.storyId);
  });

  it('does not store the story when persist is false', async () => {
    post.mockReturnValue(of({ data: aiResponse }));
    const story = await service.generateStory({
      locationId: 'muslim-quarter',
      persist: false,
    });
    expect(story.storyId).toBeUndefined();
  });

  it('falls back to the stored description when the AI service is down', async () => {
    post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

    const story = await service.generateStory({ locationId: 'silwan' });

    expect(story.generatedBy).toBe('backend-fallback');
    expect(story.narrative).toContain('Silwan');
    expect(story.uncertaintyNotes[0]).toContain('could not be reached');
  });

  it('treats an error payload from the AI module as a failure', async () => {
    post.mockReturnValue(
      of({
        data: {
          ...aiResponse,
          status: 'error',
          narrative: '',
          error: { code: 'unknown_location', message: 'no reviewed content' },
        },
      }),
    );

    const story = await service.generateStory({ locationId: 'christian-quarter' });
    expect(story.generatedBy).toBe('backend-fallback');
  });

  it('answers guide questions and reports when the source did not cover them', async () => {
    post.mockReturnValue(
      of({
        data: {
          status: 'ok',
          answer:
            'This information is not available in the reviewed records yet.',
          answered_from_source: false,
          excerpts: [],
          uncertainty_notes: ['Not covered by the reviewed content.'],
          source: {},
          model: {
            provider: 'offline-extractive',
            name: 'hikaya-extractive-v1',
          },
        },
      }),
    );

    const answer = await service.askGuide({
      question: 'How tall is the Eiffel Tower?',
      locationId: 'silwan',
    });
    expect(answer.answeredFromSource).toBe(false);
    expect(answer.answer).toContain('not available');
  });

  it.each(['ramallah', undefined])('refuses review failures with explicit or derived governorate %s', async (governorateId) => {
    post.mockReturnValue(of({ data: { ...aiResponse, status: 'error', narrative: '', error: { code: 'content_not_reviewed', message: 'Awaiting source review.' } } }));
    await expect(service.generateStory({ locationId: 'palestinian-museum', governorateId })).rejects.toThrow('Awaiting source review.');
  });

  it('uses only the Arabic record when a new governorate story needs a fallback', async () => {
    post.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    const story = await service.generateStory({ locationId: 'palestinian-museum', governorateId: 'ramallah', language: 'ar', persist: false });
    expect(story.narrative).toContain('2016');
    expect(story.narrative).not.toContain('Old City');
    expect(story.source.locationId).toBe('palestinian-museum');
  });

  it('handles guide error payloads as unavailable rather than undefined answers', async () => {
    post.mockReturnValue(of({ data: { status: 'error', error: { code: 'missing_content', message: 'No approved record.' } } }));
    await expect(service.askGuide({ locationIds: ['palestinian-museum'], governorateIds: ['ramallah'], question: 'When was it completed?' })).rejects.toThrow('No approved record.');
  });
});
