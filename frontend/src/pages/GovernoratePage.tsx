import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Footprints, MapPin, PenLine, Route, Sparkles, Waypoints } from "lucide-react";
import { NotFoundPage } from "./NotFoundPage";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorateById } from "../data/heritage";
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
import { WalkingTour } from "../components/WalkingTour";
import { LoadingRegion, SkeletonCardGrid } from "../components/Skeleton";
import { MyJerusalemStoryModal } from "../components/MyJerusalemStoryModal";
import { ScenesHero, scenesFor } from "../components/ScenesHero";
import { placesCount } from "../utils/plural";

export const GovernoratePage: React.FC = () => {
  const { governorateId = "" } = useParams();
  if (!governorateById(governorateId)) return <NotFoundPage />;
  return <GovernorateExperience key={governorateId} governorateId={governorateId} />;
};

/** Two or four places fill two columns; three columns would leave a hole. */
const placeColumns = (count: number) =>
  count % 3 === 0 || count > 4 ? "lg:grid-cols-3" : "";

/**
 * One layout for every governorate: photographs of its places, the ways in
 * (plan a trip, ask the guide, the map), its places, and the visitor's own
 * progress. Jerusalem only adds its walking-route planner.
 */
const GovernorateExperience: React.FC<{ governorateId: string }> = ({
  governorateId,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const governorate = governorateById(governorateId)!;
  const { locations, loading, source, reason } = useLocations(governorateId);
  const visited = useVisitedLocations(
    locations.length,
    locations.map((item) => item.id),
  );
  const [albumOpen, setAlbumOpen] = useState(false);
  const scenes = useMemo(() => scenesFor(governorateId, locations), [governorateId, locations]);
  const name = isArabic ? governorate.arabicName : governorate.name;
  const isJerusalem = governorateId === "jerusalem";
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduced ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduced ? 0 : delay, duration: 0.5 },
  });
  const heroLink = "inline-flex items-center gap-1.5 text-sm font-bold text-white/85 underline-offset-4 hover:text-white hover:underline";

  return (
    <PageTransition>
      <div className="space-y-12">
        <Link to="/" className="inline-block text-sm text-brand-muted hover:text-brand-olive">
          {isArabic ? "فلسطين" : "Palestine"} / {name}
        </Link>
        <DataSourceBanner source={source} reason={reason} />

        <ScenesHero
          scenes={scenes}
          arLabel={`مشاهد من ${governorate.arabicName}`}
          enLabel={`Scenes from ${governorate.name}`}
        >
          <div className="lg:col-span-7 space-y-5">
            <motion.h1
              className="font-serif font-black text-4xl sm:text-5xl leading-tight text-white [text-shadow:0_2px_22px_rgba(0,0,0,0.45)]"
              {...rise(0.1)}
            >
              {name}
            </motion.h1>
            <motion.p
              className="max-w-xl text-base leading-relaxed text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]"
              {...rise(0.2)}
            >
              {isArabic ? governorate.arabicDescription : governorate.description}
              {!loading && locations.length > 0 && (
                <span className="block mt-1 text-sm text-white/75">
                  {isArabic
                    ? `${placesCount(locations.length, true)} في الأرشيف، لكل منها سجل من مصادر موثّقة.`
                    : `${placesCount(locations.length, false)} in the archive, each from cited sources.`}
                </span>
              )}
            </motion.p>
            <motion.div className="space-y-4 pt-1" {...rise(0.3)}>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={`/governorates/${governorateId}/create-story`}
                  className="min-h-12 rounded-full bg-brand-amber px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-amber-deep inline-flex items-center gap-2"
                >
                  <Route className="w-4 h-4" />
                  {isArabic ? `خطّط رحلتك في ${name}` : `Plan your ${name} trip`}
                </Link>
                {locations[0] && (
                  <Link
                    to={`/locations/${locations[0].id}?ask=1`}
                    className="min-h-12 rounded-full border border-white/50 bg-black/20 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-black/35 inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-brand-amber-light" />
                    {isArabic ? "اسأل المرشد" : "Ask the guide"}
                  </Link>
                )}
                <Link
                  to={`/governorates/${governorateId}/map`}
                  className="min-h-12 rounded-full border border-white/50 bg-black/20 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-black/35 inline-flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  {isArabic ? "الخريطة" : "Map"}
                </Link>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {isJerusalem && (
                  <Link to="/plan-tour" className={heroLink}>
                    <Footprints className="w-4 h-4" />
                    {isArabic ? "مسار مشي في القدس" : "Jerusalem walking route"}
                  </Link>
                )}
                <Link to="/contribute" className={heroLink}>
                  <PenLine className="w-4 h-4" />
                  {isArabic ? `لديك ذكرى من ${name}؟ شاركها` : `Have a ${name} memory? Share it`}
                </Link>
                <Link to={`/governorates/${governorateId}/connections`} className={heroLink}>
                  <Waypoints className="w-4 h-4" />
                  {isArabic ? "كيف تتصل الأماكن" : "How the places connect"}
                </Link>
              </div>
            </motion.div>
          </div>
        </ScenesHero>

        <Reveal className="space-y-5">
          <h2 className="font-serif text-2xl font-black text-brand-olive">
            {isArabic ? `أماكن ${name}` : `Places in ${name}`}
          </h2>
          {loading ? (
            <>
              <SkeletonCardGrid />
              <LoadingRegion label={isArabic ? `جارٍ تحميل أماكن ${name}` : `Loading places in ${name}`} />
            </>
          ) : locations.length ? (
            <StaggerList className={`grid gap-5 md:grid-cols-2 ${placeColumns(locations.length)}`}>
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

        {!loading && locations.length > 0 && (
          <Reveal className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <ProgressTracker
              state={visited}
              scope={governorateId}
              onOpenStory={() => setAlbumOpen(true)}
            />
            <WalkingTour locations={locations} />
          </Reveal>
        )}
        <MyJerusalemStoryModal
          open={albumOpen}
          onClose={() => setAlbumOpen(false)}
          scope={governorateId}
        />
      </div>
    </PageTransition>
  );
};
