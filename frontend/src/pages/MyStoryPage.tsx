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
import { governorateById, governorateName } from "../data/heritage";

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
        <div className="rounded-3xl border border-brand-border bg-white p-8 space-y-4">
          <h1 className="text-3xl font-serif font-black text-brand-olive">
            {isArabic ? "حكايتي في فلسطين" : "My Palestine story"}
          </h1>
          <p className="text-sm text-brand-muted">
            {isArabic
              ? "أنشئ حكايتك أولاً، وستُحفظ على هذا الجهاز."
              : "Create your story first. It will be saved on this device."}
          </p>
          <Link
            to="/create-story"
            className="inline-block rounded-full bg-brand-amber px-6 py-3 text-xs font-bold text-white"
          >
            {isArabic ? "إنشاء حكايتي" : "Create my story"}
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
        <header className="rounded-3xl bg-brand-olive text-white p-7 space-y-4">
          <p className="text-xs text-brand-amber">Hikaya</p>
          <h1
            className="text-3xl font-serif font-black"
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
            <Link
              to="/create-story"
              className="rounded-full border border-white/30 px-5 py-3 text-xs font-bold"
            >
              {isArabic ? "أنشئ حكاية أخرى" : "Create another story"}
            </Link>
            <button
              onClick={download}
              className="rounded-full bg-brand-amber px-5 py-3 text-xs font-bold inline-flex gap-2 items-center"
            >
              <Download className="w-4 h-4" />
              {isArabic ? "حفظ الرحلة" : "Save journey"}
            </button>
            <button
              onClick={() => setAlbumOpen(true)}
              className="rounded-full border border-white/30 px-5 py-3 text-xs font-bold inline-flex gap-2 items-center"
            >
              <BookHeart className="w-4 h-4" />
              {isArabic ? "ألبوم ذكرياتي" : "My memory album"}
            </button>
          </div>
        </header>
        <p className="rounded-2xl bg-brand-amber/10 p-4 text-xs leading-6 text-brand-muted">
          {isArabic
            ? "صياغة شخصية مولّدة من سجلات المصادر؛ لم تعتمدها هيئة تحرير. رحلة قراءة ثقافية لا تُثبت وقت انتقال أو طريقاً أو حالة وصول."
            : "A personal narrative generated from source records, awaiting editorial approval. This cultural reading journey does not establish travel times, a physical route or access conditions."}
        </p>
        <section
          className="rounded-3xl border border-brand-border bg-white p-6"
          dir={journeyArabic ? "rtl" : "ltr"}
        >
          <h2 className="text-xl font-serif font-black text-brand-olive mb-4">
            {isArabic ? "حكاية واحدة.. أماكن متعددة" : "One story, many places"}
          </h2>
          {/* One chapter per stop, each with its own narration: a whole journey
              can run past 20,000 characters, too long to narrate in one go. */}
          <div className="space-y-8">
            {journey.stops.map((stop) => (
              <article key={stop.location.id} className="space-y-3">
                <h3 className="text-lg font-serif font-black text-brand-olive">
                  {stop.order}.{" "}
                  {stop.narrative.title || (isArabic ? stop.location.arabicName : stop.location.name)}
                </h3>
                <StoryNarrator text={stop.narrative.narrative} locationId={stop.location.id} />
              </article>
            ))}
          </div>
        </section>
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <MvpLocationMap
              locations={journey.stops.map((stop) => stop.location)}
              selectedId={selected?.id}
              onSelect={setSelected}
              bounds={bounds ?? NATIONAL_BOUNDS}
              mapLabel={isArabic ? "أماكن حكايتي" : "Places in my story"}
              routeIds={journey.stops.map((stop) => stop.location.id)}
              jerusalem={scope === "jerusalem"}
              drawRoute={false}
            />
          </div>
          <ol className="lg:col-span-5 space-y-4">
            {journey.stops.map((stop) => (
              <li
                key={stop.location.id}
                className={`rounded-3xl border p-5 space-y-3 bg-white ${selected?.id === stop.location.id ? "border-brand-amber" : "border-brand-border"}`}
              >
                <button
                  onClick={() => setSelected(stop.location)}
                  className="text-start text-xl font-serif font-black text-brand-olive"
                >
                  {stop.order}.{" "}
                  {isArabic ? stop.location.arabicName : stop.location.name}
                </button>
                <p className="text-xs text-brand-muted">
                  {governorateName(
                    stop.location.governorateId ?? "jerusalem",
                    isArabic,
                  )}
                </p>
                <p className="text-sm leading-6">{stop.narrative.summary}</p>
                <div className="flex flex-wrap gap-2 text-xs text-brand-olive font-bold">
                  {Object.entries(stop.resources).map(([key, path]) => (
                    <Link
                      key={key}
                      to={path}
                      className="rounded-full border border-brand-border px-3 py-2 hover:border-brand-amber"
                    >
                      {isArabic
                        ? {
                            story: "الحكاية",
                            timeline: "الخط الزمني",
                            gallery: "الصور",
                            quiz: "اختبر معرفتك",
                            guide: "اسأل الدليل",
                            contribute: "شارك ذكرى",
                          }[key]
                        : {
                            story: "Story",
                            timeline: "Timeline",
                            gallery: "Gallery",
                            quiz: "Quiz",
                            guide: "Ask guide",
                            contribute: "Contribute",
                          }[key]}
                    </Link>
                  ))}
                </div>
                <SourceCitationLine locationId={stop.location.id} />
              </li>
            ))}
          </ol>
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
        <section className="rounded-2xl bg-brand-bg text-xs text-brand-muted space-y-2">
          {journey.uncertaintyNotes.map((note, index) => (
            <p key={index}>{note}</p>
          ))}
        </section>
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
