import React from "react";
import { Link } from "react-router-dom";
import { BookHeart, MapPin, ArrowLeft } from "lucide-react";
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

export const PalestineHomePage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { locations, source, reason } = useLocations("all");
  return (
    <PageTransition>
      <div className="space-y-12">
        <DataSourceBanner source={source} reason={reason} />
        <section className="relative overflow-hidden rounded-3xl border border-brand-border bg-brand-olive p-7 sm:p-12 text-white">
          <div className="absolute inset-0 tatreez-grid opacity-10 pointer-events-none" />
          <div className="relative grid gap-8 md:grid-cols-[1fr_auto] items-center">
            <div className="max-w-2xl space-y-5">
              <p className="text-xs text-brand-amber font-mono tracking-widest">
                Hikaya
              </p>
              <h1 className="font-serif font-black text-4xl sm:text-5xl leading-tight">
                {isArabic
                  ? "فلسطين تحكي.. وحكاية تجمع حكاياتها"
                  : "Palestine speaks. Every place has a story."}
              </h1>
              <p className="text-sm leading-7 text-white/85">
                {isArabic
                  ? "من حارات القدس إلى متاحف رام الله وتراث الخليل وذاكرة غزة، اكتشف الأماكن من مصادر موثّقة، وصمّم حكاية ثقافية تجمع ما يهمك."
                  : "From Jerusalem’s quarters to Ramallah’s museums, Hebron’s heritage and Gaza’s memory, explore sourced place records and create a cultural story around your interests."}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/create-story"
                  className="rounded-full bg-brand-amber px-6 py-3 text-xs font-bold inline-flex items-center gap-2"
                >
                  <BookHeart className="w-4 h-4" />
                  {isArabic
                    ? "إنشاء حكايتي في فلسطين"
                    : "Create My Story in Palestine"}
                </Link>
                <Link
                  to="/palestine-map"
                  className="rounded-full border border-white/40 px-6 py-3 text-xs font-bold inline-flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  {isArabic ? "خريطة فلسطين" : "Palestine map"}
                </Link>
              </div>
            </div>
            <div className="rounded-3xl bg-brand-bg p-5 mx-auto w-36 sm:w-48">
              <img
                src="/logo-icon.png"
                alt="Hikaya"
                className="w-full object-contain mix-blend-multiply"
              />
            </div>
          </div>
        </section>
        <Reveal className="space-y-5">
          <div>
            <h2 className="font-serif font-black text-3xl text-brand-olive">
              {isArabic ? "استكشف المحافظات" : "Explore the governorates"}
            </h2>
            <p className="mt-2 text-xs text-brand-muted">
              {isArabic
                ? "أربع محافظات، أرشيف واحد قابل للنمو."
                : "Four governorates, one growing archive."}
            </p>
          </div>
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {governorates.map((governorate, index) => (
              <StaggerItem key={governorate.id}>
                <Link
                  to={`/governorates/${governorate.slug}`}
                  className="group block overflow-hidden rounded-3xl border border-brand-border bg-white shadow-sm transition hover:border-brand-amber hover:shadow-lg"
                >
                  <div className="relative h-32 bg-gradient-to-br from-brand-olive to-[#253b35] overflow-hidden">
                    {governorate.coverImageUrl && (
                      <img
                        src={governorate.coverImageUrl}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-60"
                      />
                    )}
                    <div className="absolute inset-0 tatreez-grid opacity-10" />
                    <span className="absolute bottom-5 start-6 font-serif text-3xl font-black text-white">
                      {isArabic ? governorate.arabicName : governorate.name}
                    </span>
                    <span className="absolute top-4 end-5 text-brand-amber font-mono text-xs">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="p-6 space-y-3">
                    <p className="text-sm text-brand-muted">
                      {isArabic
                        ? governorate.arabicDescription
                        : governorate.description}
                    </p>
                    <div className="flex justify-between text-xs text-brand-olive font-bold">
                      <span>
                        {
                          locations.filter(
                            (item) =>
                              (item.governorateId ?? "jerusalem") ===
                              governorate.id,
                          ).length
                        }{" "}
                        {isArabic ? "أماكن في الأرشيف" : "archived places"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        {isArabic ? "ابدأ الحكاية" : "Explore"}
                        <ArrowLeft
                          className={`w-4 h-4 ${isArabic ? "" : "rotate-180"}`}
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerList>
        </Reveal>
      </div>
    </PageTransition>
  );
};
