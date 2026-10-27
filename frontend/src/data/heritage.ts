import catalog from "./palestine-catalog.json";
import {
  locationById as jerusalemProfile,
  locations as jerusalemProfiles,
  JerusalemLocationData,
} from "../locationsData";
import {
  ApiLocation,
  ApiMedia,
  ApiQuizQuestion,
  ApiTimelineEvent,
  TourInterest,
} from "../types";

export { catalog };
export const governorates = catalog.governorates;
export const governorateById = (id: string) =>
  governorates.find((item) => item.id === id);
export const governorateName = (id: string, arabic: boolean) => {
  const item = governorateById(id);
  return item ? (arabic ? item.arabicName : item.name) : id;
};
export const nationalRecord = (id: string) =>
  catalog.locations.find((item) => item.id === id);
const reviewedRecords = catalog.locations.filter(
  (item) => item.reviewed && item.reviewStatus === "source_checked",
);
type NationalRecord = (typeof catalog.locations)[number];
type CatalogPhoto = Omit<ApiMedia, "locationId" | "type" | "sortOrder">;
const photosOf = (item: NationalRecord): CatalogPhoto[] =>
  "media" in item && Array.isArray(item.media) ? (item.media as CatalogPhoto[]) : [];
const coverOf = (item: NationalRecord) =>
  photosOf(item).find((photo) => photo.pairRole === "cover");

/** Credited photographs of the national places, shaped like the media API. */
export const nationalMedia: ApiMedia[] = reviewedRecords.flatMap((item) =>
  photosOf(item).map((photo, index) => ({
    ...photo,
    locationId: item.id,
    type: "image" as const,
    sortOrder: index,
  })),
);

export const nationalLocations: ApiLocation[] = reviewedRecords.map((record) => {
  // The photographs are served by the media API, not inside the location.
  const { media: _photos, ...item } = { media: undefined, ...record };
  return {
    ...item,
    coverImageUrl: coverOf(record)?.url,
    country: "Palestine",
    isPublished: true,
    contentFile: `content/ai-ready/${item.id}-summary.md`,
    aiSummaryFile: `content/ai-ready/${item.id}-summary.md`,
    stats: {
      storyCount: 1,
      imageCount: photosOf(record).length,
      timelineEventCount: item.timeline.length,
      memoryCount: 0,
      readingTimeMinutes: 1,
    },
  };
});

const profiles: JerusalemLocationData[] = reviewedRecords.map((item) => ({
  id: item.id,
  name: item.name,
  arabicName: item.arabicName,
  lat: item.latitude,
  lng: item.longitude,
  coverImage: coverOf(item)?.url ?? "",
  summary: item.description,
  arabicSummary: item.arabicDescription,
  culturalImportance: item.importance || item.facts,
  arabicCulturalImportance: item.arabicImportance || item.arabicFacts,
  historicalSummary: item.walkthrough || item.facts,
  arabicHistoricalSummary: item.arabicWalkthrough || item.arabicFacts,
  landmarks: item.landmarks || [],
  arabicLandmarks: item.arabicLandmarks || [],
  storyTitle: item.name,
  arabicStoryTitle: item.arabicName,
  story: [
    item.description,
    item.walkthrough,
    item.importance,
    item.facts,
    item.traditions ? `Religious tradition: ${item.traditions}` : "",
  ].filter(Boolean).join("\n\n"),
  arabicStory: [
    item.arabicDescription,
    item.arabicWalkthrough,
    item.arabicImportance,
    item.arabicFacts,
    item.arabicTraditions ? `تقليد ديني: ${item.arabicTraditions}` : "",
  ].filter(Boolean).join("\n\n"),
  imageCredit: coverOf(item)?.credit ?? "",
  imageLicense: coverOf(item)?.license ?? "",
  imageSourceUrl: coverOf(item)?.sourceUrl ?? "",
  categories: item.categories,
  interests: item.interests as TourInterest[],
}));
export const locationById = (id: string) =>
  jerusalemProfile(id) ?? profiles.find((item) => item.id === id);
export const scopedProfiles = (scope = "jerusalem") =>
  scope === "jerusalem"
    ? jerusalemProfiles
    : scope === "all"
      ? [...jerusalemProfiles, ...profiles]
      : profiles.filter(
          (item) => nationalRecord(item.id)?.governorateId === scope,
        );

export function localizeNationalTimeline(
  event: ApiTimelineEvent,
  arabic: boolean,
) {
  const record = nationalRecord(event.locationId);
  const data = record?.timeline[event.sortOrder];
  return arabic && data
    ? {
        ...event,
        periodLabel: ("arabicLabel" in data && data.arabicLabel) || event.periodLabel,
        description: data.arabicDescription,
      }
    : event;
}
export function localizeNationalQuiz(quiz: ApiQuizQuestion, arabic: boolean) {
  const record = nationalRecord(quiz.locationId);
  return arabic && record
    ? {
        ...quiz,
        question: record.quiz.arabicQuestion,
        options: record.quiz.arabicOptions,
        explanation: `${record.arabicDescription} ${record.arabicFacts} ${record.arabicTraditions}`,
      }
    : quiz;
}
export const nationalTimeline: ApiTimelineEvent[] = reviewedRecords.flatMap(
  (item) =>
    item.timeline.map((event, index) => ({
      id: `palestine-timeline-${item.id}-${index}`,
      locationId: item.id,
      periodLabel: event.label,
      description: event.description,
      sortYear: event.year,
      sortOrder: index,
      isTradition: false,
      sourceFile: `content/ai-ready/${item.id}-summary.md`,
    })),
);
export const nationalQuiz: ApiQuizQuestion[] = reviewedRecords.map((item) => ({
  id: `palestine-quiz-${item.id}`,
  locationId: item.id,
  ...item.quiz,
  explanation: `${item.description} ${item.facts} ${item.traditions}`,
  sourceNote: item.sources[0].url,
  sortOrder: 0,
}));
