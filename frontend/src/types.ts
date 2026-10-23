/**
 * Shapes returned by the Hikaya backend (`/api/v1`).
 *
 * These mirror backend/src/database/entities/* and the responses documented in
 * backend/README.md. Keep them in step when the API changes.
 */

/** Counts shown on a location card so a reader knows what is waiting inside. */
export interface LocationStats {
  storyCount: number;
  imageCount: number;
  timelineEventCount: number;
  memoryCount: number;
  readingTimeMinutes: number;
}

export interface ApiLocation {
  governorateId?: string;
  arabicDescription?: string;
  reviewStatus?: string;
  coordinateStatus?: string;
  id: string;
  name: string;
  arabicName?: string;
  city?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  coverImageUrl?: string;
  /** Internal source identifier; the UI maps it to public bibliography metadata. */
  contentFile?: string;
  aiSummaryFile?: string;
  categories: string[];
  isPublished: boolean;
  /** Present on the list endpoint; absent when a single location is fetched. */
  stats?: LocationStats;
}

export interface ApiStory {
  id: string;
  locationId: string;
  title: string;
  summary?: string;
  simplifiedStory: string;
  audience: string;
  language: string;
  tone: string;
  source?: string;
  isAiGenerated: boolean;
  uncertaintyNotes: string[];
  status: string;
  /** Optional forced-alignment data for synchronized narration highlighting. */
  timestamps?: WordTimestamp[];
}

/** A word's exact position in its narration audio. */
export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface ApiContribution {
  id: string;
  referenceCode?: string;
  locationId: string;
  title: string;
  content: string;
  contributorName?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video';
  status: "pending_review" | "approved" | "rejected";
  submittedAt: string;
}

/** An image in a location gallery. Credit and licence always travel with it. */
export interface ApiMedia {
  id: string;
  locationId: string;
  type: "image" | "audio" | "video" | "document";
  url: string;
  thumbUrl?: string;
  width?: number;
  height?: number;
  subject?: string;
  arabicSubject?: string;
  description?: string;
  arabicDescription?: string;
  era: "modern" | "historical";
  pairRole?: "cover" | "before" | "after";
  credit?: string;
  license?: string;
  licenseUrl?: string;
  capturedAt?: string;
  sourceUrl?: string;
  sortOrder: number;
}

export interface BeforeAfterResponse {
  pair: { before: ApiMedia; after: ApiMedia } | null;
  /** Why there is no pair, when there is not one. */
  reason?: string;
}

export interface ApiTimelineEvent {
  id: string;
  locationId: string;
  periodLabel: string;
  description: string;
  sortYear: number;
  sortOrder: number;
  /** Rests on religious or oral tradition rather than documented history. */
  isTradition: boolean;
  sourceFile?: string;
}

export interface ApiQuizQuestion {
  id: string;
  locationId: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  /** Where in the reviewed content the answer comes from. */
  sourceNote: string;
  sortOrder: number;
}

export interface FeaturedStory {
  story: ApiStory;
  location: ApiLocation | null;
  reason: "daily-rotation" | "random";
  forDate?: string;
}

export interface ContributionStatus {
  referenceCode: string;
  locationId: string;
  title: string;
  status: ApiContribution["status"];
  submittedAt: string;
  reviewedAt?: string | null;
  message: string;
  reviewNotes?: string | null;
}

/** Response from POST /api/v1/ai/generate-story. */
export interface GeneratedStory {
  title: string;
  summary: string;
  narrative: string;
  targetAudience: string;
  language: string;
  tone: string;
  wordCount: number;
  /** Optional forced-alignment data for synchronized narration highlighting. */
  timestamps?: WordTimestamp[];
  /** Gaps the AI declined to fill. Shown to the reader as a footnote. */
  uncertaintyNotes: string[];
  /** Fact-guard findings. Shown only as a review flag, never as content. */
  warnings: string[];
  source: {
    locationId?: string | null;
    locationName?: string | null;
    contentFile?: string | null;
    summaryFile?: string | null;
  };
  generatedBy: string;
  storyId?: string;
}

/** Response from POST /api/v1/ai/ask-guide. */
export interface GuideAnswer {
  answer: string;
  /** False means the records do not cover the question - not an error. */
  answeredFromSource: boolean;
  excerpts: string[];
  citations?: GuideCitation[];
  uncertaintyNotes: string[];
  generatedBy: string;
}

export interface GuideCitation {
  location_id?: string | null;
  location_name?: string | null;
  section: string;
  content_type: "fact" | "tradition" | "oral_heritage";
  language: string;
  excerpt: string;
  references: { title: string; url: string }[];
}

export interface ChatTurn {
  question: string;
  answer: string;
}

export interface NewContribution {
  locationId: string;
  title: string;
  content: string;
  contributorName?: string;
  contributorEmail?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video';
}

export interface ContributionReceipt {
  status: string;
  message: string;
  referenceCode?: string;
  contribution: ApiContribution;
}

export type AudienceMode =
  | "student"
  | "tourist"
  | "child"
  | "short"
  | "historian"
  | "general";

export type StoryTone = "neutral" | "educational" | "emotional" | "storytelling";

/** Where the data on screen came from, so the UI can be honest about it. */
export type DataSource = "backend" | "mock";

// --- Existing frontend-only shapes -------------------------------------------

export interface LocationData {
  id: string;
  name: string;
  arabicName: string;
  lat: number;
  lng: number;
  coverImage: string;
  summary: string;
  arabicSummary: string;
  culturalImportance: string;
  arabicCulturalImportance: string;
  historicalSummary: string;
  arabicHistoricalSummary: string;
  landmarks: string[];
  arabicLandmarks: string[];
  storyTitle: string;
  arabicStoryTitle: string;
  story: string;
  arabicStory: string;
  imageCredit: string;
  imageLicense: string;
  imageSourceUrl: string;
}

export type TourLanguage = "ar" | "en" | "fr";
export type TourDuration = "express" | "half_day" | "full_day" | "weekend";
export type TourInterest =
  | "history"
  | "architecture"
  | "religious"
  | "food_markets"
  | "oral_heritage";

export interface TourPreferences {
  language: TourLanguage;
  duration: TourDuration;
  interests: TourInterest[];
}

export interface ItineraryStop {
  order: number;
  /** Two-day routes use this to keep each day's walking coherent. */
  day: number;
  locationId: string;
  locationName: string;
  arabicName?: string;
  latitude: number;
  longitude: number;
  suggestedMinutes: number;
  walkFromPreviousMinutes: number;
  distanceFromPreviousMeters: number;
  bearingFromPreviousDegrees?: number;
  guidance: string;
  arabicGuidance: string;
  frenchGuidance: string;
  matchedInterests: TourInterest[];
}

export interface GeneratedItinerary {
  id: string;
  createdAt: string;
  title: string;
  preferences: TourPreferences;
  totalMinutes: number;
  totalWalkingMinutes: number;
  stops: ItineraryStop[];
  uncertaintyNotes: string[];
}

export interface ArtisanHighlight {
  id: string;
  locationId: string;
  name: string;
  arabicName: string;
  category: "craft" | "food" | "market";
  description: string;
  arabicDescription: string;
  supportNote: string;
  arabicSupportNote: string;
  /** A visitor-facing orientation note; never a claim about a precise address. */
  locationNote?: string;
  arabicLocationNote?: string;
  imageUrl: string;
  /** Local image used when Commons is unavailable or the visitor is offline. */
  fallbackImageUrl?: string;
  imageAlt: string;
  arabicImageAlt: string;
  imageCredit: string;
  imageLicense: string;
  imageSourceUrl: string;
}

export interface MyJerusalemStory {
  generatedAt: string;
  exploredLocationIds: string[];
  completedQuizLocationIds: string[];
  listenedLocationIds: string[];
  oralMemoriesUncovered: number;
  totalWalkingMinutes: number;
  heritageSitesDiscovered: number;
  personalPhotosCaptured: number;
  personalMemoriesWritten: number;
  badge: string;
  reflection: string;
}

/** A private journey memory stored only in this browser. */
export interface UserJourneyMemory {
  governorateId?: string;
  governorateIds?: string[];
  id: string;
  photoDataUrl: string;
  locationTag: string;
  note: string;
  createdAt: string;
}

export interface Contribution {
  id: string;
  location: string;
  title: string;
  author: string;
  narrative: string;
  imageUrl?: string;
  videoUrl?: string;
  category: string;
  date: string;
}

export interface VoiceOption {
  name: string;
  voiceName: string;
  gender: "Male" | "Female";
  description: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Governorate {
  id: string; slug: string; name: string; arabicName: string; description: string; arabicDescription: string;
  mapCenter: {latitude:number;longitude:number}; mapZoom:number;
  bounds:{minLat:number;maxLat:number;minLng:number;maxLng:number};coverImageUrl?:string;locationCount?:number;
}
export interface JourneyPreferences {
  governorateIds:string[];interests:TourInterest[];duration:TourDuration;language:'ar'|'en';targetAudience:AudienceMode;tone:StoryTone;
}
export interface CulturalJourney {
  id:string;createdAt:string;title:string;mode:'cultural';preferences:JourneyPreferences;governorateIds:string[];
  narrative:string;uncertaintyNotes:string[];source:DataSource;reviewStatus:string;
  stops:{order:number;location:ApiLocation;matchedInterests:TourInterest[];narrative:GeneratedStory;
    sourceLinks:{title:string;arabicTitle:string;url:string;publisher:string;arabicPublisher:string}[];
    resources:{story:string;timeline:string;gallery:string;quiz:string;guide:string;contribute:string}}[];
}
