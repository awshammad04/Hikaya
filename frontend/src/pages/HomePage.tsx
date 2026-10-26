import React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { PenLine, Route, Sparkles, Waypoints } from "lucide-react";
import { useLocations } from "../hooks/useLocations";
import { useVisitedLocations } from "../hooks/useVisitedLocations";
import { LocationCard } from "../components/LocationCard";
import { StoryOfTheDay } from "../components/FeaturedStoryCard";
import { ProgressTracker } from "../components/ProgressTracker";
import { WalkingTour } from "../components/WalkingTour";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { LoadingRegion, SkeletonCardGrid } from "../components/Skeleton";
import { PageTransition, Reveal, StaggerItem, StaggerList } from "../components/motion";
import { useFeaturedStory } from "../hooks/useFeaturedStory";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { JerusalemPulse } from "../components/JerusalemPulse";

export const HomePage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const { locations, loading, source, reason } = useLocations();
  const visitedState = useVisitedLocations(locations.length);

  const story = useFeaturedStory();

  return (
    <PageTransition>
      <div className="space-y-14">
        <Link to="/" className="inline-block text-sm text-brand-muted hover:text-brand-olive">{isArabic ? "فلسطين / القدس" : "Palestine / Jerusalem"}</Link>
        <DataSourceBanner source={source} reason={reason || story.error} />

        {/* --- Hero -------------------------------------------------------- */}
        <JerusalemPulse>
            <div className="lg:col-span-7 space-y-5">
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
                className="space-y-4 pt-1 sm:pt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduced ? 0 : 0.35 }}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/plan-tour"
                    className="min-h-12 rounded-full bg-brand-amber px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-amber-deep inline-flex items-center gap-2"
                  >
                    <Route className="w-4 h-4" />
                    {isArabic ? "صمّم جولتك في القدس" : "Plan your tour"}
                  </Link>
                  <Link
                    to={`/locations/${locations[0]?.id ?? "muslim-quarter"}?ask=1`}
                    className="min-h-12 rounded-full border border-white/50 bg-black/20 px-6 py-3 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-black/35 inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 text-brand-amber-light" />
                    {isArabic ? "اسأل حكاية" : "Ask Hikaya"}
                  </Link>
                </div>
                <Link
                  to="/contribute"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-white/85 underline-offset-4 hover:text-white hover:underline"
                >
                  <PenLine className="w-4 h-4" />
                  {isArabic ? "لديك ذكرى من القدس؟ شاركها" : "Have a Jerusalem memory? Share it"}
                </Link>
              </motion.div>
            </div>
        </JerusalemPulse>

        {/* --- Story of the day -------------------------------------------- */}
        <StoryOfTheDay story={story} />

        {/* --- Locations --------------------------------------------------- */}
        <Reveal className="space-y-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-serif font-black text-2xl text-brand-olive">
                {isArabic ? "أحياء وحارات القدس" : "Jerusalem quarters & neighbourhoods"}
              </h2>
              <p className="text-sm text-brand-muted">
                {isArabic ? "ثماني بوابات لفهم تراث المدينة الحي." : "Eight focused gateways into the city’s living heritage."}
              </p>
            </div>
            <Link
              to="/constellation"
              className="text-sm font-bold text-brand-olive hover:text-brand-amber transition-colors inline-flex items-center gap-1.5"
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
