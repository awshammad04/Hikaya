import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { PenLine, Route, Sparkles, Waypoints } from "lucide-react";
import { useLocations } from "../hooks/useLocations";
import { useVisitedLocations } from "../hooks/useVisitedLocations";
import { LocationCard } from "../components/LocationCard";
import { FeaturedStoryCard } from "../components/FeaturedStoryCard";
import { ProgressTracker } from "../components/ProgressTracker";
import { WalkingTour } from "../components/WalkingTour";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { LoadingRegion, SkeletonCardGrid, SkeletonLine } from "../components/Skeleton";
import { PageTransition, Reveal, StaggerItem, StaggerList } from "../components/motion";
import { getFeaturedStory, getRandomStory } from "../services/api";
import { FeaturedStory } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { JerusalemPulse } from "../components/JerusalemPulse";

export const HomePage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const { locations, loading, source, reason } = useLocations();
  const visitedState = useVisitedLocations(locations.length);

  const [featured, setFeatured] = useState<FeaturedStory | null>(null);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [shuffling, setShuffling] = useState(false);

  useEffect(() => {
    let active = true;
    getFeaturedStory()
      .then((result) => {
        if (active) setFeatured(result.data);
      })
      .finally(() => {
        if (active) setFeaturedLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const shuffle = async () => {
    setShuffling(true);
    try {
      const result = await getRandomStory(featured?.story.id);
      setFeatured(result.data);
    } finally {
      setShuffling(false);
    }
  };

  return (
    <PageTransition>
      <div className="space-y-14">
        <Link to="/" className="text-xs text-brand-muted hover:text-brand-olive">{isArabic ? "فلسطين / القدس" : "Palestine / Jerusalem"}</Link>
        <DataSourceBanner source={source} reason={reason} />

        {/* --- Hero -------------------------------------------------------- */}
        <JerusalemPulse>
            <div className="lg:col-span-7 space-y-5">
              <motion.p
                className="text-[10px] font-mono uppercase tracking-widest text-brand-amber"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduced ? 0 : 0.1 }}
              >
                Hikaya
              </motion.p>

              <motion.h1
                className="max-w-3xl font-serif font-black text-4xl sm:text-5xl leading-tight text-white [text-shadow:0_2px_22px_rgba(0,0,0,0.45)]"
                initial={{ opacity: 0, y: reduced ? 0 : 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.15, duration: 0.5 }}
              >
                {isArabic ? "القدس تحكي.. وحكاية توثّق وتُرشد" : "Places Remember. Jerusalem Speaks."}
              </motion.h1>

              <motion.p
                className="text-sm text-white/85 leading-relaxed max-w-xl [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]"
                initial={{ opacity: 0, y: reduced ? 0 : 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduced ? 0 : 0.25, duration: 0.5 }}
              >
                {isArabic
                  ? "مرشد شخصي ذكي لحارات القدس وأبوابها المقدسة وأسواقها التراثية. يستند كل مسار وكل حكاية إلى مصادر راجعتها حكاية؛ وحين تكون المعلومة ناقصة يصرّح الدليل بذلك ولا يخمّن."
                  : "An AI-powered personal guide to Jerusalem’s quarters, sacred gates and traditional souqs. Every route and story is grounded in reviewed Hikaya sources; where the record is incomplete, the guide says so instead of guessing."}
              </motion.p>

              <motion.div
                className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:flex-wrap sm:items-center sm:gap-3 sm:pt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduced ? 0 : 0.35 }}
              >
                <Link
                  to="/plan-tour"
                  className="min-h-11 justify-center rounded-2xl bg-brand-olive px-2 py-2 text-center text-[9px] font-serif font-black uppercase tracking-[0.07em] text-brand-bg transition-colors hover:bg-[#4a4a35] inline-flex items-center gap-1.5 sm:min-h-12 sm:w-auto sm:rounded-full sm:px-6 sm:py-3 sm:text-xs sm:tracking-widest sm:gap-2"
                >
                  <Route className="w-3.5 h-3.5 text-brand-amber" />
                  <span className="sm:hidden">{isArabic ? "صمّم جولتك" : "Plan your tour"}</span>
                  <span className="hidden sm:inline">{isArabic ? "صمّم جولتك الذكية في القدس" : "Plan Your Tour"}</span>
                </Link>
                <Link
                  to={`/locations/${locations[0]?.id ?? "muslim-quarter"}?ask=1`}
                  className="min-h-11 justify-center rounded-2xl bg-brand-amber px-2 py-2 text-center text-[9px] font-serif font-black uppercase tracking-[0.07em] text-white transition-colors hover:bg-[#b45f05] inline-flex items-center gap-1.5 sm:min-h-12 sm:w-auto sm:rounded-full sm:px-6 sm:py-3 sm:text-xs sm:tracking-widest sm:gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="sm:hidden">{isArabic ? "اسأل الدليل" : "Ask the guide"}</span>
                  <span className="hidden sm:inline">{isArabic ? "اسأل حكاية" : "Ask Hikaya"}</span>
                </Link>
                <Link
                  to="/contribute"
                  className="col-span-2 min-h-10 justify-center rounded-2xl border border-white/45 bg-black/15 px-3 py-2 text-center text-[9px] font-serif font-black uppercase tracking-[0.1em] text-white backdrop-blur-md transition-colors hover:border-brand-amber hover:bg-black/30 inline-flex items-center gap-1.5 sm:min-h-12 sm:w-auto sm:rounded-full sm:px-6 sm:py-3 sm:text-xs sm:tracking-widest sm:gap-2"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  {isArabic ? "شارك ذكرى" : "Share a memory"}
                </Link>
              </motion.div>
            </div>
        </JerusalemPulse>

        {/* --- Story of the day -------------------------------------------- */}
        <Reveal className="space-y-4">
          <h2 className="font-serif font-black text-2xl text-brand-olive">
            {isArabic ? "حكاية اليوم" : "Story of the day"}
          </h2>
          {featuredLoading ? (
            <div className="bg-white rounded-3xl border border-brand-border overflow-hidden grid grid-cols-1 md:grid-cols-5">
              <SkeletonLine className="h-48 md:col-span-2 rounded-none" />
              <div className="md:col-span-3 p-6 space-y-3">
                <SkeletonLine className="h-3 w-28" />
                <SkeletonLine className="h-6 w-3/4" />
                <SkeletonLine className="h-3 w-full" />
                <SkeletonLine className="h-3 w-5/6" />
              </div>
              <LoadingRegion label={isArabic ? "جارٍ تحميل حكاية اليوم" : "Loading the story of the day"} />
            </div>
          ) : (
            featured && (
              <FeaturedStoryCard
                featured={featured}
                onShuffle={() => void shuffle()}
                shuffling={shuffling}
              />
            )
          )}
        </Reveal>

        {/* --- Locations --------------------------------------------------- */}
        <Reveal className="space-y-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-serif font-black text-2xl text-brand-olive">
                {isArabic ? "أحياء وحارات القدس" : "Jerusalem quarters & neighbourhoods"}
              </h2>
              <p className="text-xs text-brand-muted font-serif italic">
                {isArabic ? "ثماني بوابات لفهم تراث المدينة الحي." : "Eight focused gateways into the city’s living heritage."}
              </p>
            </div>
            <Link
              to="/constellation"
              className="text-xs font-serif font-bold uppercase tracking-widest text-brand-olive hover:text-brand-amber transition-colors inline-flex items-center gap-1.5"
            >
              <Waypoints className="w-3.5 h-3.5" />
              {isArabic ? "شاهد كيف تتصل الأماكن" : "See how they connect"}
            </Link>
          </div>

          {loading ? (
            <>
              <SkeletonCardGrid />
              <LoadingRegion label={isArabic ? "جارٍ تحميل أماكن القدس" : "Loading locations"} />
            </>
          ) : (
            <StaggerList className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {locations.map((location) => (
                <StaggerItem key={location.id}>
                  <LocationCard
                    location={location}
                    visited={visitedState.hasVisited(location.id)}
                  />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </Reveal>

        {/* --- Personal --------------------------------------------------- */}
        {!loading && (
          <Reveal className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ProgressTracker state={visitedState} />
            <WalkingTour locations={locations} />
          </Reveal>
        )}
      </div>
    </PageTransition>
  );
};
