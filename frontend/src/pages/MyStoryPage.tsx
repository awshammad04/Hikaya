import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Download, BookHeart } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { readJourney } from "../services/journeys";
import { MvpLocationMap } from "../components/MvpLocationMap";
import { StoryNarrator } from "../components/StoryNarrator";
import { HeritageChat } from "../components/HeritageChat";
import { MyJerusalemStoryModal } from "../components/MyJerusalemStoryModal";
import { SourceCitationLine } from "../components/SourceCitationLine";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { PageTransition } from "../components/motion";
import { ApiLocation } from "../types";
import { NATIONAL_BOUNDS } from "./HeritageMapPage";
import { governorateById, governorateName, locationById } from "../data/heritage";

const RESOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  story: { ar: "صفحة المكان", en: "Place page" },
  timeline: { ar: "الخط الزمني", en: "Timeline" },
  gallery: { ar: "الصور", en: "Gallery" },
  quiz: { ar: "اختبر معرفتك", en: "Quiz" },
  guide: { ar: "اسأل الدليل", en: "Ask guide" },
  contribute: { ar: "شارك ذكرى", en: "Contribute" },
};

export const MyStoryPage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const [journey] = useState(readJourney);
  const [selected, setSelected] = useState<ApiLocation | null>(
    journey?.stops[0]?.location ?? null,
  );
  const [albumOpen, setAlbumOpen] = useState(false);
  if (!journey)
    return (
      <PageTransition>
        <div className="rounded-3xl border border-brand-border bg-brand-surface p-8 space-y-4">
          <h1 className="text-3xl font-serif font-black text-brand-olive">
            {isArabic ? "رحلتي في فلسطين" : "My Palestine trip"}
          </h1>
          <p className="text-sm text-brand-muted">
            {isArabic
              ? "خطّط رحلتك أولاً، وستُحفظ على هذا الجهاز."
              : "Plan your trip first. It will be saved on this device."}
          </p>
          <Link
            to="/create-story"
            className="inline-block rounded-full bg-brand-amber px-6 py-3 text-sm font-bold text-white"
          >
            {isArabic ? "خطّط رحلتك" : "Plan your trip"}
          </Link>
        </div>
      </PageTransition>
    );
  const journeyArabic = journey.preferences.language === "ar";
  const scope =
    journey.governorateIds.length === 1 ? journey.governorateIds[0] : "all";
  const bounds =
    journey.governorateIds.length === 1
      ? governorateById(scope)?.bounds
      : NATIONAL_BOUNDS;
  const showChapter = (location: ApiLocation) => {
    setSelected(location);
    document.getElementById(`chapter-${location.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(journey, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "hikaya-my-story.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <PageTransition>
      <div className="space-y-8">
        <DataSourceBanner source={journey.source ?? "backend"} />
        <header className="rounded-3xl bg-brand-olive text-white p-7 sm:p-10 space-y-4">
          <h1
            className="text-3xl sm:text-4xl font-serif font-black"
            dir={journeyArabic ? "rtl" : "ltr"}
          >
            {journey.title}
          </h1>
          <p className="text-sm text-white/80">
            {journey.governorateIds
              .map((id) => governorateName(id, isArabic))
              .join(" · ")}{" "}
            · {journey.stops.length} {isArabic ? "فصول" : "chapters"}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={download}
              className="rounded-full bg-brand-amber px-5 py-3 text-sm font-bold inline-flex gap-2 items-center transition-colors hover:bg-brand-amber-deep"
            >
              <Download className="w-4 h-4" />
              {isArabic ? "حفظ الرحلة" : "Save journey"}
            </button>
            <button
              type="button"
              onClick={() => setAlbumOpen(true)}
              className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold inline-flex gap-2 items-center transition-colors hover:bg-white/10"
            >
              <BookHeart className="w-4 h-4" />
              {isArabic ? "ألبوم رحلتي" : "My trip album"}
            </button>
            <Link
              to="/create-story"
              className="rounded-full px-3 py-3 text-sm font-bold text-white/80 underline-offset-4 hover:text-white hover:underline"
            >
              {isArabic ? "خطّط رحلة أخرى" : "Plan another trip"}
            </Link>
          </div>
        </header>
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <aside className="space-y-4 lg:col-span-5 lg:order-last lg:sticky lg:top-24">
            <MvpLocationMap
              locations={journey.stops.map((stop) => stop.location)}
              selectedId={selected?.id}
              onSelect={showChapter}
              bounds={bounds ?? NATIONAL_BOUNDS}
              mapLabel={isArabic ? "أماكن رحلتي" : "Places on my trip"}
              routeIds={journey.stops.map((stop) => stop.location.id)}
              jerusalem={scope === "jerusalem"}
              drawRoute={false}
            />
          </aside>
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-3xl border border-brand-border bg-brand-surface p-5 space-y-4">
              <h2 className="text-xl font-serif font-black text-brand-olive">
                {isArabic ? "رحلة واحدة.. أماكن متعددة" : "One trip, many places"}
              </h2>
              <ol className="flex flex-wrap gap-2">
                {journey.stops.map((stop) => (
                  <li key={stop.location.id}>
                    <button
                      type="button"
                      onClick={() => showChapter(stop.location)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${selected?.id === stop.location.id ? "border-brand-amber bg-brand-amber/10 text-brand-olive" : "border-brand-border text-brand-muted hover:text-brand-olive"}`}
                    >
                      {stop.order}. {isArabic ? stop.location.arabicName : stop.location.name}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            {journey.stops.map((stop) => {
              const cover = locationById(stop.location.id)?.coverImage;
              const name = isArabic ? stop.location.arabicName : stop.location.name;
              return (
                <article
                  key={stop.location.id}
                  id={`chapter-${stop.location.id}`}
                  className={`scroll-mt-24 overflow-hidden rounded-3xl border bg-brand-surface transition-colors ${selected?.id === stop.location.id ? "border-brand-amber" : "border-brand-border"}`}
                  dir={journeyArabic ? "rtl" : "ltr"}
                >
                  {cover && <img src={cover} alt="" className="h-48 w-full object-cover" loading="lazy" />}
                  <div className="space-y-5 p-6 sm:p-8">
                    <button type="button" onClick={() => setSelected(stop.location)} className="flex items-center gap-4 text-start">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-olive font-serif text-lg font-black text-white">
                        {stop.order}
                      </span>
                      <span>
                        <span className="block font-serif text-2xl font-black text-brand-olive">{name}</span>
                        <span className="block text-sm text-brand-muted">
                          {governorateName(stop.location.governorateId ?? "jerusalem", isArabic)}
                        </span>
                      </span>
                    </button>
                    {/* Each chapter has its own narration: a whole journey can run past
                        20,000 characters, too long to narrate in one go. */}
                    <StoryNarrator text={stop.narrative.narrative} locationId={stop.location.id} />
                    <div className="flex flex-wrap gap-2 text-sm text-brand-olive font-bold">
                      {Object.entries(stop.resources).map(([key, path]) => (
                        <Link
                          key={key}
                          to={path}
                          className="rounded-full border border-brand-border px-3 py-2 transition-colors hover:border-brand-amber"
                        >
                          {isArabic ? RESOURCE_LABELS[key]?.ar : RESOURCE_LABELS[key]?.en}
                        </Link>
                      ))}
                    </div>
                    <SourceCitationLine locationId={stop.location.id} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <HeritageChat
          location={{
            id: "",
            name: isArabic ? "هذه الرحلة الثقافية" : "this cultural journey",
            country: "Palestine",
            categories: [],
            isPublished: true,
          }}
          scope={{
            governorateIds: journey.governorateIds,
            locationIds: journey.stops.map((stop) => stop.location.id),
          }}
          suggestions={
            isArabic
              ? [
                  "ما التاريخ الموثق لهذه الأماكن؟",
                  "ما المعلومات الموثقة عن عمارة هذه الأماكن؟",
                ]
              : [
                  "What history is documented for these places?",
                  "What is documented about these buildings?",
                ]
          }
        />
        <MyJerusalemStoryModal
          open={albumOpen}
          onClose={() => setAlbumOpen(false)}
          scope={scope}
          locationIds={journey.stops.map((stop) => stop.location.id)}
        />
      </div>
    </PageTransition>
  );
};
