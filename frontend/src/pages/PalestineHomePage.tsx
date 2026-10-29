import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Headphones, MapPin, Route, Search } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import {
  PageTransition,
  Reveal,
  StaggerList,
  StaggerItem,
} from "../components/motion";
import { governorates, scopedProfiles } from "../data/heritage";
import { useLocations } from "../hooks/useLocations";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { PlaceSearchBox } from "../components/PlaceSearchBox";
import { PalestineMiniMap } from "../components/PalestineGeography";
import { governoratesCount, placesCount } from "../utils/plural";
import { DailyQuestion } from "../components/DailyQuestion";
import { StoryOfTheDay } from "../components/FeaturedStoryCard";
import { useFeaturedStory } from "../hooks/useFeaturedStory";

const STEPS = [
  {
    icon: Search,
    ar: "ابحث عن مكان",
    en: "Find a place",
    arText: "ابحث بالاسم أو تصفّح المحافظات والخريطة؛ لكل مكان سجل موثّق المصادر.",
    enText: "Search by name or browse the governorates and the map; every place has a sourced record.",
    to: "/places",
    arLink: "كل الأماكن",
    enLink: "All places",
  },
  {
    icon: Headphones,
    ar: "اقرأ واستمع",
    en: "Read and listen",
    arText: "في صفحة كل مكان: النص بصوت راوٍ، وخط زمني وصور، ومرشد تسأله.",
    enText: "On every place page: narrated text, a timeline, photos and a guide to ask.",
  },
  {
    icon: Route,
    ar: "خطّط رحلتك",
    en: "Plan your trip",
    arText: "اختر المحافظات واهتماماتك ووقتك، فنكتب لك رحلة تجمع الأماكن في حكاية واحدة.",
    enText: "Choose governorates, interests and time, and Hikaya writes a trip that links the places into one story.",
    to: "/create-story",
    arLink: "خطّط رحلتك في فلسطين",
    enLink: "Plan your Palestine trip",
  },
];

export const PalestineHomePage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { locations, source, reason } = useLocations("all");
  const story = useFeaturedStory();
  // The bundled records give the count before the list arrives.
  const placeTotal = locations.length || scopedProfiles("all").length;
  // An odd count leaves the last row half empty, so the first card spans it.
  const wideFirst = governorates.length % 2 === 1;
  return (
    <PageTransition>
      <div className="space-y-14">
        <DataSourceBanner source={source} reason={reason || story.error} />
        {/* Not clipped, so the search suggestions can hang below the hero. */}
        <section className="relative rounded-3xl bg-brand-olive p-7 sm:p-12 text-white">
          <div className="absolute inset-0 rounded-[inherit] tatreez-grid opacity-10 pointer-events-none" />
          <div className="relative grid gap-10 md:grid-cols-[1fr_minmax(0,22rem)] items-center">
            <div className="max-w-2xl space-y-6">
              <h1 className="font-serif font-black text-4xl sm:text-5xl leading-tight">
                {isArabic
                  ? "فلسطين تحكي.. وحكاية تجمع حكاياتها"
                  : "Palestine speaks. Every place has a story."}
              </h1>
              <p className="text-base leading-8 text-white/85">
                {isArabic
                  ? `${placesCount(placeTotal, true)} من القدس إلى غزة، لكل منها سجل من مصادر موثّقة. ابحث عن مكان أو اختر محافظة لتبدأ.`
                  : `${placesCount(placeTotal, false)} from Jerusalem to Gaza, each with a record from cited sources. Search for a place or pick a governorate to begin.`}
              </p>
              <PlaceSearchBox locations={locations} />
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/places"
                  className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2 transition-colors hover:bg-white/25"
                >
                  {isArabic ? "تصفّح كل الأماكن" : "Browse all places"}
                  <ArrowLeft className={`w-4 h-4 ${isArabic ? "" : "rotate-180"}`} />
                </Link>
                <Link
                  to="/palestine-map"
                  className="rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2 transition-colors hover:bg-white/10"
                >
                  <MapPin className="w-4 h-4" />
                  {isArabic ? "خريطة فلسطين" : "Palestine map"}
                </Link>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-black/15 p-4">
              <PalestineMiniMap interactive className="w-full h-auto" />
              <p className="mt-2 text-center text-xs text-white/70">
                {isArabic ? "اختر محافظة لتبدأ" : "Choose a governorate to begin"}
              </p>
            </div>
          </div>
        </section>

        <Reveal className="space-y-5">
          <div>
            <h2 className="font-serif font-black text-3xl text-brand-olive">
              {isArabic ? "استكشف المحافظات" : "Explore the governorates"}
            </h2>
            <p className="mt-2 text-sm text-brand-muted">
              {isArabic
                ? `${governoratesCount(governorates.length, true)}، أرشيف واحد قابل للنمو.`
                : `${governoratesCount(governorates.length, false)}, one growing archive.`}
            </p>
          </div>
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {governorates.map((governorate, index) => {
              const count = locations.filter(
                (item) => (item.governorateId ?? "jerusalem") === governorate.id,
              ).length;
              const wide = wideFirst && index === 0;
              return (
                <StaggerItem key={governorate.id} className={wide ? "sm:col-span-2" : undefined}>
                  <Link
                    to={`/governorates/${governorate.slug}`}
                    className="group block h-full overflow-hidden rounded-3xl border border-brand-border bg-brand-surface shadow-sm transition hover:border-brand-amber hover:shadow-lg"
                  >
                    <div className={`relative overflow-hidden bg-gradient-to-br from-brand-olive to-[#2d3a2c] ${wide ? "h-40 sm:h-56" : "h-40"}`}>
                      {governorate.coverImageUrl ? (
                        <img
                          src={governorate.coverImageUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 tatreez-grid opacity-10" />
                          <PalestineMiniMap
                            highlight={governorate.id}
                            focus
                            className="absolute inset-0 h-full w-full"
                          />
                        </>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <span className="absolute bottom-4 start-6 font-serif text-3xl font-black text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">
                        {isArabic ? governorate.arabicName : governorate.name}
                      </span>
                    </div>
                    <div className="p-6 space-y-4">
                      <p className="text-sm leading-6 text-brand-text/80">
                        {isArabic
                          ? governorate.arabicDescription
                          : governorate.description}
                      </p>
                      <div className="flex items-center justify-between text-sm font-bold">
                        <span className="text-brand-muted">
                          {placesCount(count, isArabic)}
                        </span>
                        <span className="inline-flex items-center gap-2 text-brand-olive transition-colors group-hover:text-brand-amber">
                          {isArabic ? "استكشف" : "Explore"}
                          <ArrowLeft
                            className={`w-4 h-4 transition-transform group-hover:-translate-x-1 ${isArabic ? "" : "rotate-180"}`}
                          />
                        </span>
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerList>
        </Reveal>

        <StoryOfTheDay story={story} />

        <DailyQuestion />

        <Reveal className="space-y-5">
          <h2 className="font-serif font-black text-3xl text-brand-olive">
            {isArabic ? "كيف تعمل حكاية" : "How Hikaya works"}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, ar, en, arText, enText, to, arLink, enLink }, index) => (
              <li key={en} className="flex flex-col rounded-3xl border border-brand-border bg-brand-surface p-6 gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-amber/10 text-brand-amber">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-sm font-bold text-brand-muted">{index + 1}</span>
                </div>
                <h3 className="font-serif text-xl font-black text-brand-olive">{isArabic ? ar : en}</h3>
                <p className="flex-1 text-sm leading-6 text-brand-muted">{isArabic ? arText : enText}</p>
                {to && (
                  <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-olive hover:text-brand-amber">
                    {isArabic ? arLink : enLink}
                    <ArrowLeft className={`w-4 h-4 ${isArabic ? "" : "rotate-180"}`} />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </PageTransition>
  );
};
