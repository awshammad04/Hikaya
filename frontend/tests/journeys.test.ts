import assert from "node:assert/strict";
import {
  selectJourneyLocations,
  createJourney,
} from "../src/services/journeys";
import { generateStory, ApiError } from "../src/services/api";
import { MOCK_LOCATIONS } from "../src/mocks/mockApiData";
import {
  nationalLocations,
  governorates,
  locationById,
} from "../src/data/heritage";
import { JourneyPreferences } from "../src/types";

const all = [
  ...MOCK_LOCATIONS.map((item) => ({ ...item, governorateId: "jerusalem" })),
  ...nationalLocations,
];
const preferences: JourneyPreferences = {
  governorateIds: governorates.map((item) => item.id),
  language: "en",
  duration: "express",
  interests: ["religious"],
  targetAudience: "general",
  tone: "neutral",
};
const selected = selectJourneyLocations(preferences, all);
assert.deepEqual(
  new Set(selected.map((item) => item.location.governorateId)),
  new Set(preferences.governorateIds),
);
for (const governorate of governorates) {
  const scoped = selectJourneyLocations(
    { ...preferences, governorateIds: [governorate.id] },
    all,
  );
  assert.ok(scoped.length);
  assert.ok(
    scoped.every((item) => item.location.governorateId === governorate.id),
  );
}
assert.throws(() =>
  selectJourneyLocations({ ...preferences, governorateIds: ["invalid"] }, all),
);
assert.ok(locationById("palestinian-museum")?.arabicStory.includes("2016"));
assert.equal(locationById("palestinian-museum")?.coverImage, "");
assert.equal(MOCK_LOCATIONS.length, 8);
console.log(
  "Frontend journey selection, scope isolation, Arabic data and legacy fallback checks passed.",
);

const originalFetch = globalThis.fetch;
const originalWarn = console.warn;
try {
  console.warn = () => undefined;
  globalThis.fetch = async () => {
    throw new Error("Simulated offline backend");
  };
  const fallback = await createJourney({
    ...preferences,
    language: "ar",
    targetAudience: "student",
    tone: "educational",
  });
  assert.equal(fallback.source, "mock");
  assert.deepEqual(
    new Set(fallback.stops.map((stop) => stop.location.governorateId)),
    new Set(preferences.governorateIds),
  );
  const local = await generateStory(
    "palestinian-museum",
    "student",
    "educational",
    "ar",
  );
  assert.equal(local.data.tone, "educational");
  assert.ok(local.data.narrative.includes("حقائق موثقة"));
  assert.ok(local.data.narrative.includes("2016"));
  const short = await generateStory(
    "palestinian-museum",
    "short",
    "neutral",
    "ar",
  );
  assert.ok(short.data.wordCount < local.data.wordCount);
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Content awaiting review." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  await assert.rejects(
    () => generateStory("palestinian-museum", "student"),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
  await assert.rejects(
    () => createJourney(preferences),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
  console.log(
    "Offline national journeys, bilingual audience/tone handling and review refusal checks passed.",
  );
} finally {
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
}
