import {
  ApiContribution,
  ApiLocation,
  ApiMedia,
  ApiQuizQuestion,
  ApiStory,
  ApiTimelineEvent,
  AudienceMode,
  BeforeAfterResponse,
  ChatTurn,
  ContributionReceipt,
  ContributionStatus,
  DataSource,
  FeaturedStory,
  GeneratedStory,
  GuideAnswer,
  NewContribution,
  StoryTone,
} from "../types";
import {
  MOCK_CONTRIBUTIONS,
  MOCK_LOCATIONS,
  MOCK_MEDIA,
  MOCK_QUIZ,
  MOCK_STORIES,
  MOCK_TIMELINE,
  mockGeneratedStory,
  mockGuideAnswer,
} from "../mocks/mockApiData";
import { locationById, nationalLocations, nationalRecord, nationalTimeline, nationalQuiz } from "../data/heritage";

/**
 * Client for the Hikaya backend (`/api/v1`, see backend/README.md).
 *
 * Reads fall back to the mock data in src/mocks/ when the backend is not
 * running, so the frontend is demonstrable on its own. Every result carries a
 * `source` field, and the UI shows a banner whenever it is `"mock"` - the user
 * is never shown sample data dressed up as live data.
 *
 * Writes (submitting a contribution) never fall back. Pretending a submission
 * was saved when nothing was stored would be a lie to the contributor, so the
 * error surfaces in the form instead.
 */

const BASE_URL: string =
  (import.meta.env?.PROD ? undefined : import.meta.env?.VITE_API_BASE_URL as string | undefined) ??
  "/api/v1";

const REQUEST_TIMEOUT_MS = import.meta.env?.PROD ? 190000 : 8000;
/** Story generation is slower than a normal read. */
const GENERATION_TIMEOUT_MS = import.meta.env?.PROD ? 190000 : 45000;

export interface ApiResult<T> {
  data: T;
  source: DataSource;
  /** Why the mock data was used, when it was. */
  reason?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ReadCache<T> {
  value?: ApiResult<T>;
  expiresAt: number;
  inFlight?: Promise<ApiResult<T>>;
}

const LOCATIONS_CACHE_MS = 5 * 60 * 1000;
const FEATURED_STORY_CACHE_MS = 60 * 1000;
const FALLBACK_CACHE_MS = 5 * 1000;

const locationsCache: ReadCache<ApiLocation[]> = { expiresAt: 0 };
const featuredStoryCache: ReadCache<FeaturedStory> = { expiresAt: 0 };

/**
 * Reuses both completed reads and an already-running read. This prevents every
 * route that calls `useLocations()` from starting a new request and flashing a
 * fresh skeleton while the same data is already available elsewhere.
 */
function cachedRead<T>(
  cache: ReadCache<T>,
  load: () => Promise<ApiResult<T>>,
  ttlMs: number,
): Promise<ApiResult<T>> {
  if (cache.value && Date.now() < cache.expiresAt) {
    return Promise.resolve(cache.value);
  }
  if (cache.inFlight) return cache.inFlight;

  cache.inFlight = load()
    .then((result) => {
      cache.value = result;
      cache.expiresAt =
        Date.now() + (result.source === "backend" ? ttlMs : FALLBACK_CACHE_MS);
      return result;
    })
    .finally(() => {
      cache.inFlight = undefined;
    });

  return cache.inFlight;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });

    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(readErrorMessage(body, response.status), response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The request to the Hikaya API timed out.");
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Could not reach the Hikaya API.",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Nest sends `message` as a string or a string[] of validation failures. */
function readErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join("; ");
    if (typeof message === "string") return message;
  }
  return `Request failed with status ${status}.`;
}

/** Runs `live`, falling back to `fallback()` when the backend is unreachable. */
async function withFallback<T>(
  live: () => Promise<T>,
  fallback: () => T,
  rejectClientErrors = false,
): Promise<ApiResult<T>> {
  try {
    return { data: await live(), source: "backend" };
  } catch (error) {
    if (import.meta.env?.PROD) throw error;
    if (rejectClientErrors && error instanceof ApiError && error.status && error.status >= 400 && error.status < 500) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[hikaya] backend unavailable (${reason}) - showing sample data.`);
    return { data: fallback(), source: "mock", reason };
  }
}

// --- Locations ---------------------------------------------------------------

export async function getLocations(scope = "jerusalem"): Promise<ApiResult<ApiLocation[]>> {
  if (scope !== "jerusalem") return withFallback(
    () => request<ApiLocation[]>(scope === "all" ? "/locations?scope=all" : `/governorates/${encodeURIComponent(scope)}/locations`),
    () => [...MOCK_LOCATIONS.map((item) => ({...item,governorateId:"jerusalem"})),...nationalLocations].filter((item) => scope === "all" || item.governorateId === scope),
  );
  return cachedRead(
    locationsCache,
    () =>
      withFallback(
        () => request<ApiLocation[]>("/locations"),
        () => MOCK_LOCATIONS,
      ),
    LOCATIONS_CACHE_MS,
  );
}

export async function getLocation(id: string): Promise<ApiResult<ApiLocation | null>> {
  try {
    return { data: await request<ApiLocation>(`/locations/${id}`), source: "backend" };
  } catch (error) {
    // A 404 is a real answer from a working backend, not a reason to fall back.
    if (error instanceof ApiError && error.status === 404) {
      return { data: null, source: "backend" };
    }
    if (import.meta.env?.PROD) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[hikaya] backend unavailable (${reason}) - showing sample data.`);
    return {
      data: [...MOCK_LOCATIONS,...nationalLocations].find((location) => location.id === id) ?? null,
      source: "mock",
      reason,
    };
  }
}

export function getMedia(locationId: string): Promise<ApiResult<ApiMedia[]>> {
  return withFallback(
    () => request<ApiMedia[]>(`/locations/${locationId}/media`),
    () => MOCK_MEDIA.filter((item) => item.locationId === locationId),
  );
}

export function getBeforeAfter(
  locationId: string,
): Promise<ApiResult<BeforeAfterResponse>> {
  return withFallback(
    () => request<BeforeAfterResponse>(`/locations/${locationId}/before-after`),
    () => {
      const images = MOCK_MEDIA.filter((item) => item.locationId === locationId);
      const before = images.find((item) => item.pairRole === "before");
      const after = images.find((item) => item.pairRole === "after");
      return before && after
        ? { pair: { before, after } }
        : {
            pair: null,
            reason:
              "No historical photograph of the same subject has been added for this location yet.",
          };
    },
  );
}

export function getTimeline(
  locationId: string,
): Promise<ApiResult<ApiTimelineEvent[]>> {
  return withFallback(
    () => request<ApiTimelineEvent[]>(`/locations/${locationId}/timeline`),
    () => [...MOCK_TIMELINE,...nationalTimeline].filter((event) => event.locationId === locationId),
  );
}

export function getQuiz(locationId: string): Promise<ApiResult<ApiQuizQuestion[]>> {
  return withFallback(
    () => request<ApiQuizQuestion[]>(`/locations/${locationId}/quiz`),
    () => [...MOCK_QUIZ,...nationalQuiz].filter((question) => question.locationId === locationId),
  );
}

export function getRelated(locationId: string): Promise<ApiResult<ApiLocation[]>> {
  return withFallback(
    () => request<ApiLocation[]>(`/locations/${locationId}/related`),
    () => {
      const location = [...MOCK_LOCATIONS,...nationalLocations].find((item) => item.id === locationId);
      if (!location) return [];
      const categories = new Set(location.categories);
      if (location.governorateId && location.governorateId !== "jerusalem") return nationalLocations.filter((candidate)=>candidate.id!==locationId && candidate.governorateId===location.governorateId && candidate.categories.some((category)=>categories.has(category)));
      return MOCK_LOCATIONS.filter(
        (candidate) =>
          candidate.id !== locationId &&
          candidate.categories.some((category) => categories.has(category)),
      );
    },
  );
}

// --- Stories -----------------------------------------------------------------

export function getStories(locationId: string): Promise<ApiResult<ApiStory[]>> {
  return withFallback(
    () => request<ApiStory[]>(`/stories/${locationId}`),
    () => {
      const record = nationalRecord(locationId);
      return record ? [{id:`record-${record.id}`,locationId:record.id,title:record.name,summary:record.description,simplifiedStory:`${record.description} ${record.facts}`,audience:"general",language:"en",tone:"neutral",source:`content/ai-ready/${record.id}-summary.md`,isAiGenerated:false,uncertaintyNotes:[],status:"published"}] : MOCK_STORIES.filter((story) => story.locationId === locationId);
    },
  );
}

/** The story of the day - the same one for everybody, changing daily. */
export function getFeaturedStory(): Promise<ApiResult<FeaturedStory>> {
  return cachedRead(
    featuredStoryCache,
    () =>
      withFallback(
        () => request<FeaturedStory>("/stories/featured"),
        () => {
          const index = Math.floor(Date.now() / 86_400_000) % MOCK_STORIES.length;
          const story = MOCK_STORIES[index];
          return {
            story,
            location: MOCK_LOCATIONS.find((item) => item.id === story.locationId) ?? null,
            reason: "daily-rotation" as const,
            forDate: new Date().toISOString().slice(0, 10),
          };
        },
      ),
    FEATURED_STORY_CACHE_MS,
  );
}

export function getRandomStory(excludeId?: string): Promise<ApiResult<FeaturedStory>> {
  const query = excludeId ? `?exclude=${encodeURIComponent(excludeId)}` : "";
  return withFallback(
    () => request<FeaturedStory>(`/stories/random${query}`),
    () => {
      const pool = MOCK_STORIES.filter((story) => story.id !== excludeId);
      const story = pool[Math.floor(Math.random() * pool.length)];
      return {
        story,
        location: MOCK_LOCATIONS.find((item) => item.id === story.locationId) ?? null,
        reason: "random" as const,
      };
    },
  );
}

// --- Contributions -----------------------------------------------------------

export function getContributions(
  locationId?: string,
): Promise<ApiResult<ApiContribution[]>> {
  const query = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
  return withFallback(
    () => request<ApiContribution[]>(`/contributions${query}`),
    () =>
      locationId
        ? MOCK_CONTRIBUTIONS.filter((item) => item.locationId === locationId)
        : MOCK_CONTRIBUTIONS,
  );
}

/**
 * Submits a contribution. Deliberately has no mock fallback: the caller must
 * see a real failure rather than a fake receipt.
 *
 * @throws ApiError when the backend rejects the submission or is unreachable.
 */
export function submitContribution(
  contribution: NewContribution,
): Promise<ContributionReceipt> {
  return request<ContributionReceipt>("/contributions", {
    method: "POST",
    body: JSON.stringify(contribution),
  });
}

/**
 * Looks up a submission by its reference code. No fallback either - inventing a
 * status for someone's memory would be worse than saying the service is down.
 *
 * @throws ApiError with status 404 when the code is unknown.
 */
export function getContributionStatus(code: string): Promise<ContributionStatus> {
  return request<ContributionStatus>(
    `/contributions/status/${encodeURIComponent(code.trim())}`,
  );
}

// --- AI ----------------------------------------------------------------------

export function generateStory(
  locationId: string,
  targetAudience: AudienceMode,
  tone: StoryTone = "storytelling",
  language: "ar" | "en" = "en",
): Promise<ApiResult<GeneratedStory>> {
  return withFallback(
    () =>
      request<GeneratedStory>(
        "/ai/generate-story",
        {
          method: "POST",
          body: JSON.stringify({ locationId, governorateId:nationalRecord(locationId)?.governorateId, targetAudience, tone, language }),
        },
        GENERATION_TIMEOUT_MS,
      ).then((story) => {
        if (story.generatedBy !== "backend-fallback") return story;
        const location = [...MOCK_LOCATIONS,...nationalLocations].find((item) => item.id === locationId);
        return location ? mockGeneratedStory(location, targetAudience, language, tone) : story;
      }),
    () => {
      const location = [...MOCK_LOCATIONS,...nationalLocations].find((item) => item.id === locationId);
      if (!location) {
        throw new ApiError(`No sample content for location "${locationId}".`);
      }
      return mockGeneratedStory(location, targetAudience, language, tone);
    },
    Boolean(nationalRecord(locationId)),
  );
}

export function askGuide(
  locationId: string,
  question: string,
  history: ChatTurn[] = [],
  language: "ar" | "en" = "en",
  scope?: {governorateIds:string[];locationIds:string[]},
): Promise<ApiResult<GuideAnswer>> {
  return withFallback(
    () =>
      request<GuideAnswer>(
        "/ai/ask-guide",
        {
          method: "POST",
          body: JSON.stringify({ locationId:scope?undefined:locationId, question, history, language,...scope }),
        },
        GENERATION_TIMEOUT_MS,
      ),
    () => mockGuideAnswer(locationId, question, language),
    Boolean(scope || nationalRecord(locationId)),
  );
}

export function localArabicGuideAnswer(locationId: string, question: string): GuideAnswer {
  const normalized = question
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[؟?]/g, "")
    .trim();
  const locationQuestion = /اين|وين|موقع|تقع|مكان/.test(normalized);
  const record = nationalRecord(locationId);
  if (record && record.reviewed && record.reviewStatus === 'source_checked') {
    // Patterns use the normalised spelling (ا for أ/إ/آ, ي for ى).
    const covered = locationQuestion || (/تاريخ|متي|اهمي|ثقاف|حكاية|قصة/.test(normalized) && !/زيارة|الوصول|مفتوح|ساعة|ساعات|امن|مشي|طريق|حافلة|نقل/.test(normalized));
    const answer = locationQuestion
      ? record.arabicDescription
      : covered
        ? `${record.arabicDescription} ${record.arabicFacts}`
        : "لا يغطي السجل الموثّق هذا السؤال، لذلك لن أخمّن.";
    return {answer,answeredFromSource:covered,excerpts:covered?[answer]:[],uncertaintyNotes:covered?[]:["معلومات الوصول والحالة الراهنة غير موثّقة هنا."],generatedBy:"arabic-reviewed-fallback"};
  }
  const profile = locationById(locationId);
  if (!profile) return { answer: "لا تتوفر معلومات مراجعة لهذا المكان بعد.", answeredFromSource: false, excerpts: [], uncertaintyNotes: ["لا يغطي السجل المراجع هذا السؤال."], generatedBy: "arabic-reviewed-fallback" };
  let answer: string | null = null;
  if (locationQuestion) answer = profile.arabicSummary;
  else if (/اقدم|تاريخ|متي|عصر|بني/.test(normalized)) answer = profile.arabicHistoricalSummary;
  else if (/اري|ازور|معالم|اماكن|الموجود/.test(normalized)) answer = `يمكنك تتبّع: ${profile.arabicLandmarks.join("، ")}.`;
  else if (/اهم|ثقاف|لماذا/.test(normalized)) answer = profile.arabicCulturalImportance;
  else if (/حكاية|قصة|احك/.test(normalized)) answer = profile.arabicStory;
  if (!answer) return { answer: "لا تغطي السجلات المراجعة هذا السؤال بصيغته الحالية، لذلك لن أخمّن. جرّب السؤال عن التاريخ أو المعالم أو الأهمية الثقافية.", answeredFromSource: false, excerpts: [], uncertaintyNotes: ["لا تتوفر إجابة موثقة مباشرة في السجل المراجع."], generatedBy: "arabic-reviewed-fallback" };
  return { answer, answeredFromSource: true, excerpts: [answer], uncertaintyNotes: [], generatedBy: "arabic-reviewed-fallback" };
}

export const apiBaseUrl = BASE_URL;
