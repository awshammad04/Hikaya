import {
  ApiLocation,
  CulturalJourney,
  JourneyPreferences,
  TourInterest,
} from "../types";
import {
  catalog,
  governorateById,
  locationById,
  nationalRecord,
} from "../data/heritage";
import { apiBaseUrl, ApiError, getLocations, generateStory } from "./api";

export const JOURNEY_KEY = "hikaya.palestine.journey.v1";

export function selectJourneyLocations(
  preferences: JourneyPreferences,
  all: ApiLocation[],
) {
  if (
    !preferences.governorateIds.length ||
    preferences.governorateIds.some((id) => !governorateById(id))
  )
    throw new ApiError("Choose valid governorates.");
  const pools = [...new Set(preferences.governorateIds)].map((id) =>
    all
      .filter((item) => (item.governorateId ?? "jerusalem") === id)
      .map((location) => ({
        location,
        matchedInterests: preferences.interests.filter((interest) =>
          locationById(location.id)?.interests.includes(interest),
        ),
      }))
      .sort(
        (a, b) =>
          b.matchedInterests.length - a.matchedInterests.length ||
          a.location.id.localeCompare(b.location.id),
      ),
  );
  const count = Math.max(
    pools.length,
    { express: 3, half_day: 5, full_day: 7, weekend: 14 }[preferences.duration],
  );
  const selected: {
    location: ApiLocation;
    matchedInterests: TourInterest[];
  }[] = [];
  while (selected.length < count && pools.some((pool) => pool.length)) {
    for (const pool of pools) {
      if (selected.length >= count) break;
      const item = pool.shift();
      if (item) selected.push(item);
    }
  }
  return selected;
}

export async function createJourney(
  preferences: JourneyPreferences,
): Promise<CulturalJourney> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), import.meta.env.PROD ? 190000 : 60000);
  try {
    const response = await fetch(`${apiBaseUrl}/journeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new ApiError(
        typeof data.message === "string"
          ? data.message
          : "Could not create this journey.",
        response.status,
      );
    return { ...data, source: "backend" };
  } catch (error) {
    if (import.meta.env.PROD) throw error;
    if (error instanceof ApiError && error.status && error.status < 500)
      throw error;
    const all = (await getLocations("all")).data;
    const selected = selectJourneyLocations(preferences, all);
    if (!selected.length)
      throw new ApiError("No content is available in this selection.");
    const stops = await Promise.all(
      selected.map(async ({ location, matchedInterests }, index) => ({
        order: index + 1,
        location,
        matchedInterests,
        narrative: (
          await generateStory(
            location.id,
            preferences.targetAudience,
            preferences.tone,
            preferences.language,
          )
        ).data,
        sourceLinks: nationalRecord(location.id)?.sources ?? [],
        resources: {
          story: `/locations/${location.id}`,
          timeline: `/locations/${location.id}?tab=timeline`,
          gallery: `/locations/${location.id}?tab=gallery`,
          quiz: `/locations/${location.id}?tab=quiz`,
          guide: `/locations/${location.id}?ask=1`,
          contribute: `/contribute?location=${location.id}`,
        },
      })),
    );
    const names = preferences.governorateIds
      .map((id) => governorateById(id)!)
      .map((item) =>
        preferences.language === "ar" ? item.arabicName : item.name,
      );
    return {
      id: `local-${Date.now()}`,
      createdAt: new Date().toISOString(),
      title:
        preferences.language === "ar"
          ? `حكايتي: ${names.join(" · ")}`
          : `My story: ${names.join(" · ")}`,
      mode: "cultural",
      preferences,
      governorateIds: preferences.governorateIds,
      stops,
      narrative: stops
        .map(
          (stop) =>
            `${stop.order}. ${stop.narrative.title}\n${stop.narrative.narrative}`,
        )
        .join("\n\n"),
      uncertaintyNotes: [
        preferences.language === "ar" ? catalog.gaps.ar : catalog.gaps.en,
        preferences.language === "ar"
          ? "تم إنشاء هذه الرحلة من النسخة المحلية للمحتوى."
          : "Created from the local content fallback.",
      ],
      source: "mock",
      reviewStatus: "generated_not_editorially_approved",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function readJourney(): CulturalJourney | null {
  try {
    const data = JSON.parse(localStorage.getItem(JOURNEY_KEY) ?? "null");
    if (
      data?.mode !== "cultural" ||
      !Array.isArray(data.governorateIds) ||
      !Array.isArray(data.stops) ||
      !data.preferences ||
      typeof data.narrative !== "string"
    )
      return null;
    if (
      data.governorateIds.some((id: string) => !governorateById(id)) ||
      data.stops.some(
        (stop: CulturalJourney["stops"][number]) =>
          !stop?.location?.id ||
          !data.governorateIds.includes(
            stop.location.governorateId ?? "jerusalem",
          ),
      )
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
