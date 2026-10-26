import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookHeart, Headphones, MapPin, Sparkles } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import {
  PageTransition,
  Reveal,
  StaggerList,
  StaggerItem,
} from "../components/motion";
import { governorates } from "../data/heritage";
import { useLocations } from "../hooks/useLocations";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { PalestineMiniMap } from "../components/PalestineGeography";
import { placesCount } from "../utils/plural";
import { DailyQuestion } from "../components/DailyQuestion";

const STEPS = [
  {
    icon: MapPin,
    ar: "اختر مكاناً",
    en: "Pick a place",
    arText: "ابدأ من محافظة أو من الخريطة، وكل مكان له سجل موثّق المصادر.",
    enText: "Start from a governorate or the map; every place has a sourced record.",
  },
  {
    icon: Headphones,
    ar: "اقرأ واستمع",
    en: "Read and listen",
    arText: "حكايات مراجَعة بصوت راوٍ، مع خط زمني وصور وأسئلة للدليل.",
    enText: "Reviewed stories with narration, a timeline, photos and a guide to ask.",
  },
  {
    icon: Sparkles,
    ar: "أنشئ حكايتك",
    en: "Create your story",
    arText: "اختر اهتماماتك ووقتك، فتجمع حكاية الأماكن في حكاية واحدة لك.",
    enText: "Choose your interests and time, and Hikaya weaves the places into one story.",
  },
];

export const PalestineHomePage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { locations, source, reason } = useLocations("all");
  return (
    <PageTransition>
      <div className="space-y-14">
        <DataSourceBanner source={source} reason={reason} />
        <section className="relative overflow-hidden rounded-3xl bg-brand-olive p-7 sm:p-12 text-white">
          <div className="absolute inset-0 tatreez-grid opacity-10 pointer-events-none" />
          <div className="relative grid gap-10 md:grid-cols-[1fr_minmax(0,22rem)] items-center">
            <div className="max-w-2xl space-y-6">
              <h1 className="font-serif font-black text-4xl sm:text-5xl leading-tight">
                {isArabic
                  ? "فلسطين تحكي.. وحكاية تجمع حكاياتها"
                  : "Palestine speaks. Every place has a story."}
              </h1>
              <p className="text-base leading-8 text-white/85">
                {isArabic
                  ? "من حارات القدس إلى متاحف رام الله وتراث الخليل وذاكرة غزة، اكتشف الأماكن من مصادر موثّقة، وصمّم حكاية ثقافية تجمع ما يهمك."
                  : "From Jerusalem’s quarters to Ramallah’s museums, Hebron’s heritage and Gaza’s memory, explore sourced place records and create a cultural story around your interests."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/create-story"
                  className="rounded-full bg-brand-amber px-6 py-3 text-sm font-bold inline-flex items-center gap-2 transition-colors hover:bg-brand-amber-deep"
                >
                  <BookHeart className="w-4 h-4" />
                  {isArabic ? "أنشئ حكايتك في فلسطين" : "Create your Palestine story"}
                </Link>
                <Link
                  to="/palestine-map"
                  className="rounded-full border border-white/40 px-6 py-3 text-sm font-bold inline-flex items-center gap-2 transition-colors hover:bg-white/10"
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
                ? "أربع محافظات، أرشيف واحد قابل للنمو."
                : "Four governorates, one growing archive."}
            </p>
          </div>
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {governorates.map((governorate) => {
              const count = locations.filter(
                (item) => (item.governorateId ?? "jerusalem") === governorate.id,
              ).length;
              return (
                <StaggerItem key={governorate.id}>
                  <Link
                    to={`/governorates/${governorate.slug}`}
                    className="group block h-full overflow-hidden rounded-3xl border border-brand-border bg-brand-surface shadow-sm transition hover:border-brand-amber hover:shadow-lg"
                  >
                    <div className="relative h-40 overflow-hidden bg-gradient-to-br from-brand-olive to-[#2d3a2c]">
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
                          {placesCount(count, isArabic)} {isArabic ? "في الأرشيف" : "in the archive"}
                        </span>
                        <span className="inline-flex items-center gap-2 text-brand-olive transition-colors group-hover:text-brand-amber">
                          {isArabic ? "ابدأ الحكاية" : "Explore"}
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

        <DailyQuestion />

        <Reveal className="space-y-5">
          <h2 className="font-serif font-black text-3xl text-brand-olive">
            {isArabic ? "كيف تعمل حكاية" : "How Hikaya works"}
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, ar, en, arText, enText }, index) => (
              <li key={en} className="rounded-3xl border border-brand-border bg-brand-surface p-6 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-amber/10 text-brand-amber">
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="text-sm font-bold text-brand-muted">{index + 1}</span>
                </div>
                <h3 className="font-serif text-xl font-black text-brand-olive">{isArabic ? ar : en}</h3>
                <p className="text-sm leading-6 text-brand-muted">{isArabic ? arText : enText}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </PageTransition>
  );
};
