import catalog from "./palestine-catalog.json";
import {
  locationById as jerusalemProfile,
  locations as jerusalemProfiles,
  JerusalemLocationData,
} from "../locationsData";
import {
  ApiLocation,
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
export const nationalLocations: ApiLocation[] = reviewedRecords.map((item) => ({
  ...item,
  country: "Palestine",
  isPublished: true,
  contentFile: `content/ai-ready/${item.id}-summary.md`,
  aiSummaryFile: `content/ai-ready/${item.id}-summary.md`,
  stats: {
    storyCount: 1,
    imageCount: 0,
    timelineEventCount: item.timeline.length,
    memoryCount: 0,
    readingTimeMinutes: 1,
  },
}));

const profiles: JerusalemLocationData[] = reviewedRecords.map((item) => ({
  id: item.id,
  name: item.name,
  arabicName: item.arabicName,
  lat: item.latitude,
  lng: item.longitude,
  coverImage: "",
  summary: item.description,
  arabicSummary: item.arabicDescription,
  culturalImportance: item.facts,
  arabicCulturalImportance: item.arabicFacts,
  historicalSummary: item.facts,
  arabicHistoricalSummary: item.arabicFacts,
  landmarks: [],
  arabicLandmarks: [],
  storyTitle: item.name,
  arabicStoryTitle: item.arabicName,
  story: `${item.description}\n\n${item.facts}${item.traditions ? `\n\nReligious tradition: ${item.traditions}` : ""}`,
  arabicStory: `${item.arabicDescription}\n\n${item.arabicFacts}${item.arabicTraditions ? `\n\nتقليد ديني: ${item.arabicTraditions}` : ""}`,
  imageCredit: "",
  imageLicense: "",
  imageSourceUrl: "",
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
    ? { ...event, description: data.arabicDescription }
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
