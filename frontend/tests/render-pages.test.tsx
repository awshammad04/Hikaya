import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "../src/context/LanguageContext";
import { AppLayout } from "../src/components/AppLayout";
import { PalestineHomePage } from "../src/pages/PalestineHomePage";
import { GovernoratePage } from "../src/pages/GovernoratePage";
import { CreateStoryPage } from "../src/pages/CreateStoryPage";
import { MyStoryPage } from "../src/pages/MyStoryPage";
import { MyJerusalemStoryModal } from "../src/components/MyJerusalemStoryModal";
import { MvpLocationMap } from "../src/components/MvpLocationMap";
import { governorates, nationalLocations } from "../src/data/heritage";
import { MOCK_LOCATIONS } from "../src/mocks/mockApiData";

// Static rendering checks the actual shared components in both interface languages.
// It does not substitute for browser interaction or responsive visual review.
const storage = new Map<string, string>();
const localStorageStub = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
};
Object.assign(globalThis, {
  window: {
    localStorage: localStorageStub,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  },
  localStorage: localStorageStub,
});

function render(
  path: string,
  element: React.ReactElement,
  route = path,
  layout = true,
) {
  return renderToStaticMarkup(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          {layout ? (
            <Route element={<AppLayout />}>
              <Route path={route} element={element} />
            </Route>
          ) : (
            <Route path={route} element={element} />
          )}
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

for (const language of ["ar", "en"]) {
  storage.set("hikaya-quds.language", language);
  const home = render("/", <PalestineHomePage />);
  assert.ok(
    home.includes(
      language === "ar"
        ? "إنشاء حكايتي في فلسطين"
        : "Create My Story in Palestine",
    ),
  );
  for (const governorate of governorates) {
    assert.ok(home.includes(`/governorates/${governorate.id}`));
    assert.ok(
      home.includes(
        language === "ar" ? governorate.arabicName : governorate.name,
      ),
    );
  }
  assert.doesNotMatch(home, /hackathon|هاكاثون|Q.?GUIDE/i);
  for (const governorate of governorates.filter(
    (item) => item.id !== "jerusalem",
  )) {
    const regional = render(
      `/governorates/${governorate.id}`,
      <GovernoratePage />,
      "/governorates/:governorateId",
    );
    assert.ok(
      regional.includes(`/governorates/${governorate.id}/create-story`),
    );
    const wizard = render(
      `/governorates/${governorate.id}/create-story`,
      <CreateStoryPage />,
      "/governorates/:governorateId/create-story",
    );
    assert.ok(
      wizard.includes(
        language === "ar"
          ? `إنشاء حكايتي في ${governorate.arabicName}`
          : `Create My Story in ${governorate.name}`,
      ),
    );
    const album = render(
      "/album",
      <MyJerusalemStoryModal
        open
        onClose={() => undefined}
        scope={governorate.id}
      />,
      "/album",
      false,
    );
    assert.doesNotMatch(
      album,
      /images\/jerusalem|Mount of Olives|جبل الزيتون|Walking min|دقائق مشي/,
    );
    assert.ok(
      album.includes(
        language === "ar" ? governorate.arabicName : governorate.name,
      ),
    );
    const locations = nationalLocations.filter(
      (item) => item.governorateId === governorate.id,
    );
    const map = render(
      "/map-check",
      <MvpLocationMap
        locations={locations}
        onSelect={() => undefined}
        bounds={governorate.bounds}
        mapLabel={governorate.name}
        jerusalem={false}
        drawRoute={false}
        routeIds={locations.map((item) => item.id)}
      />,
      "/map-check",
      false,
    );
    assert.equal(
      (map.match(/data-map-marker/g) ?? []).length,
      locations.filter(
        (item) => item.latitude != null && item.longitude != null,
      ).length,
    );
    assert.doesNotMatch(
      map,
      /<polyline|Illustrated Jerusalem|خريطة توضيحية للقدس/,
    );
    for (const other of nationalLocations.filter(
      (item) => item.governorateId !== governorate.id,
    )) {
      assert.ok(
        !map.includes(language === "ar" ? other.arabicName! : other.name),
      );
    }
  }
  const legacyMap = render(
    "/map-check",
    <MvpLocationMap locations={MOCK_LOCATIONS} onSelect={() => undefined} />,
    "/map-check",
    false,
  );
  assert.equal((legacyMap.match(/data-map-marker/g) ?? []).length, 8);
  assert.ok(
    legacyMap.includes(
      language === "ar" ? "خريطة توضيحية للقدس" : "Illustrated Jerusalem map",
    ),
  );
  const empty = render("/my-story", <MyStoryPage />);
  assert.ok(empty.includes('href="/create-story"'));
}
console.log(
  "Arabic/English page rendering, national navigation, scoped wizards and honest memory albums passed.",
);
