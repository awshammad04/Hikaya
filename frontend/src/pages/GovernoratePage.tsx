import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage";
import { BookHeart, MapPin, Route } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorateById, catalog } from "../data/heritage";
import { useLocations } from "../hooks/useLocations";
import { useVisitedLocations } from "../hooks/useVisitedLocations";
import {
  PageTransition,
  Reveal,
  StaggerList,
  StaggerItem,
} from "../components/motion";
import { LocationCard } from "../components/LocationCard";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { ProgressTracker } from "../components/ProgressTracker";
import { SkeletonCardGrid } from "../components/Skeleton";
import { MyJerusalemStoryModal } from "../components/MyJerusalemStoryModal";
import { HomePage } from "./HomePage";
import { PalestineMiniMap } from "../components/PalestineGeography";

export const GovernoratePage: React.FC = () => {
  const { governorateId = "" } = useParams();
  const governorate = governorateById(governorateId);
  if (!governorate) return <NotFoundPage />;
  return governorateId === "jerusalem" ? (
    <HomePage />
  ) : (
    <RegionalExperience key={governorateId} governorateId={governorateId} />
  );
};

const RegionalExperience: React.FC<{ governorateId: string }> = ({
  governorateId,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const governorate = governorateById(governorateId)!;
  const { locations, loading, source, reason } = useLocations(governorateId);
  const visited = useVisitedLocations(
    locations.length,
    locations.map((item) => item.id),
  );
  const [albumOpen, setAlbumOpen] = useState(false);
  const name = isArabic ? governorate.arabicName : governorate.name;
  return (
    <PageTransition>
      <div className="space-y-8">
        <Link to="/" className="inline-block text-sm text-brand-muted hover:text-brand-olive">
          {isArabic ? "فلسطين" : "Palestine"} / {name}
        </Link>
        <DataSourceBanner source={source} reason={reason} />
        <section className="relative overflow-hidden rounded-3xl bg-brand-olive text-white">
          <div className="absolute inset-0 tatreez-grid opacity-10 pointer-events-none" />
          <PalestineMiniMap
            highlight={governorateId}
            focus
            className="absolute inset-0 h-full w-full opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-olive via-brand-olive/80 to-brand-olive/20 rtl:bg-gradient-to-l" />
          <div className="relative max-w-2xl space-y-5 p-7 sm:p-10">
            <h1 className="font-serif font-black text-4xl sm:text-5xl">{name}</h1>
            <p className="text-base leading-7 text-white/85">
              {isArabic ? governorate.arabicDescription : governorate.description}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to={`/governorates/${governorateId}/create-story`}
                className="rounded-full bg-brand-amber px-5 py-3 text-sm font-bold inline-flex gap-2 items-center transition-colors hover:bg-brand-amber-deep"
              >
                <BookHeart className="w-4 h-4" />
                {isArabic ? `أنشئ حكايتك في ${name}` : `Create your ${name} story`}
              </Link>
              <Link
                to={`/governorates/${governorateId}/map`}
                className="rounded-full border border-white/40 px-5 py-3 text-sm font-bold inline-flex gap-2 items-center transition-colors hover:bg-white/10"
              >
                <MapPin className="w-4 h-4" />
                {isArabic ? "الخريطة" : "Map"}
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-white/80">
              <Link to={`/governorates/${governorateId}/connections`} className="underline-offset-4 hover:text-white hover:underline">
                {isArabic ? "الروابط والذاكرة" : "Connections & memory"}
              </Link>
              <button type="button" onClick={() => setAlbumOpen(true)} className="underline-offset-4 hover:text-white hover:underline">
                {isArabic ? `تذكار رحلتي في ${name}` : `My ${name} keepsake`}
              </button>
            </div>
          </div>
        </section>
        <p className="rounded-2xl border border-brand-amber/20 bg-brand-amber/5 p-4 text-sm leading-6 text-brand-muted">
          {isArabic ? catalog.gaps.ar : catalog.gaps.en}
        </p>
        <Reveal className="space-y-5">
          <h2 className="font-serif text-2xl font-black text-brand-olive">
            {isArabic ? `أماكن ${name}` : `Places in ${name}`}
          </h2>
          {loading ? (
            <SkeletonCardGrid />
          ) : locations.length ? (
            <StaggerList className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {locations.map((location) => (
                <StaggerItem key={location.id}>
                  <LocationCard
                    location={location}
                    visited={visited.hasVisited(location.id)}
                  />
                </StaggerItem>
              ))}
            </StaggerList>
          ) : (
            <p className="text-sm text-brand-muted">
              {isArabic
                ? "لم تُنشر أماكن في هذه المحافظة بعد."
                : "No places have been published in this governorate yet."}
            </p>
          )}
        </Reveal>
        <ProgressTracker
          state={visited}
          scope={governorateId}
          onOpenStory={() => setAlbumOpen(true)}
        />
        <MyJerusalemStoryModal
          open={albumOpen}
          onClose={() => setAlbumOpen(false)}
          scope={governorateId}
        />
      </div>
    </PageTransition>
  );
};
