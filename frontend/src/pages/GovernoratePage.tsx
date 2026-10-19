import React, { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
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

export const GovernoratePage: React.FC = () => {
  const { governorateId = "" } = useParams();
  const governorate = governorateById(governorateId);
  if (!governorate) return <Navigate to="/" replace />;
  return governorateId === "jerusalem" ? (
    <>
      <div className="mb-5 flex flex-wrap gap-3">
        <Link
          to="/governorates/jerusalem/create-story"
          className="rounded-full bg-brand-amber px-5 py-3 text-xs font-bold text-white"
        >
          إنشاء حكايتي في القدس · Create My Story in Jerusalem
        </Link>
      </div>
      <HomePage />
    </>
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
        <Link to="/" className="text-xs text-brand-muted">
          {isArabic ? "فلسطين" : "Palestine"} / {name}
        </Link>
        <DataSourceBanner source={source} reason={reason} />
        <section className="relative overflow-hidden rounded-3xl bg-brand-olive p-7 sm:p-10 text-white space-y-5">
          <div className="absolute inset-0 tatreez-grid opacity-10 pointer-events-none" />
          <p className="relative text-xs text-brand-amber">Hikaya</p>
          <h1 className="relative font-serif font-black text-4xl">{name}</h1>
          <p className="relative text-sm text-white/80">
            {isArabic ? governorate.arabicDescription : governorate.description}
          </p>
          <div className="relative flex flex-wrap gap-3">
            <Link
              to={`/governorates/${governorateId}/create-story`}
              className="rounded-full bg-brand-amber px-5 py-3 text-xs font-bold inline-flex gap-2 items-center"
            >
              <BookHeart className="w-4 h-4" />
              {isArabic
                ? `إنشاء حكايتي في ${name}`
                : `Create My Story in ${name}`}
            </Link>
            <Link
              to={`/governorates/${governorateId}/map`}
              className="rounded-full border border-white/30 px-5 py-3 text-xs font-bold inline-flex gap-2 items-center"
            >
              <MapPin className="w-4 h-4" />
              {isArabic ? "الخريطة" : "Map"}
            </Link>
            <Link
              to={`/governorates/${governorateId}/connections`}
              className="rounded-full border border-white/30 px-5 py-3 text-xs font-bold"
            >
              {isArabic ? "الروابط والذاكرة" : "Connections & memory"}
            </Link>
            <button
              onClick={() => setAlbumOpen(true)}
              className="rounded-full border border-white/30 px-5 py-3 text-xs font-bold"
            >
              {isArabic ? "ألبوم حكايتي" : "My story album"}
            </button>
          </div>
        </section>
        <p className="rounded-2xl bg-brand-amber/10 p-4 text-xs leading-6 text-brand-muted">
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
