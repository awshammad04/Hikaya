import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  HelpCircle,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Milestone,
  PenLine,
  Sparkles,
  ShoppingBag,
  ExternalLink,
  Navigation2,
  Quote,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  ApiContribution,
  ApiLocation,
  ApiMedia,
  ApiQuizQuestion,
  ApiStory,
  ApiTimelineEvent,
  BeforeAfterResponse,
  DataSource,
} from "../types";
import {
  getBeforeAfter,
  getContributions,
  getLocation,
  getMedia,
  getQuiz,
  getRelated,
  getStories,
  getTimeline,
} from "../services/api";
import { useVisitedLocations } from "../hooks/useVisitedLocations";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { CoverImage } from "../components/CoverImage";
import { Tabs, TabPanel, TabDefinition } from "../components/Tabs";
import { HistoricalTimeline } from "../components/HistoricalTimeline";
import { Gallery } from "../components/Gallery";
import { BeforeAfterSlider } from "../components/BeforeAfterSlider";
import { StoryWizard } from "../components/StoryWizard";
import { HeritageChat } from "../components/HeritageChat";
import { HeritageQuiz } from "../components/HeritageQuiz";
import { StoryNarrator } from "../components/StoryNarrator";
import { LocationCard } from "../components/LocationCard";
import { LoadingRegion, SkeletonLine, SkeletonText } from "../components/Skeleton";
import { PageTransition, Reveal } from "../components/motion";
import { LocalArtisansSection } from "../components/LocalArtisansSection";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById, governorateName, nationalRecord, catalog } from "../data/heritage";
import { visitorWalkthrough } from "../visitorWalkthroughs";
import { SourceCitationLine } from "../components/SourceCitationLine";
import { markMemoryUncovered } from "../services/progress";
import { InAppWalkingRouteModal } from "../components/InAppWalkingRouteModal";

interface PageData {
  location: ApiLocation | null;
  stories: ApiStory[];
  contributions: ApiContribution[];
  media: ApiMedia[];
  timeline: ApiTimelineEvent[];
  quiz: ApiQuizQuestion[];
  related: ApiLocation[];
  beforeAfter: BeforeAfterResponse;
}

const EMPTY: PageData = {
  location: null,
  stories: [],
  contributions: [],
  media: [],
  timeline: [],
  quiz: [],
  related: [],
  beforeAfter: { pair: null },
};

/**
 * Location details page.
 *
 * Everything about one place, split into tabs so the page stops being an
 * endless scroll: the story, the documented facts, the timeline, the
 * photographs, and what people remember.
 *
 * `?ask=1` opens on the guide (the "Ask Hikaya" call to action), and `?tour=1`
 * opens on the story and starts reading it aloud (the walking tour).
 */
export const LocationDetailsPage: React.FC = () => {
  const { isArabic, language } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const { locationId = "" } = useParams();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<PageData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<DataSource>("backend");
  const [reason, setReason] = useState<string | undefined>();
  const [routeOpen, setRouteOpen] = useState(false);
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(searchParams.get("ask") ? "guide" : ["story","timeline","gallery","quiz","memories","artisans"].includes(requestedTab ?? "") ? requestedTab! : "story");

  const { markVisited, hasVisited } = useVisitedLocations(0);
  const walkingTour = searchParams.get("tour") === "1";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReason(undefined);
    setData(EMPTY);

    Promise.all([
      getLocation(locationId),
      getStories(locationId),
      getContributions(locationId),
      getMedia(locationId),
      getTimeline(locationId),
      getQuiz(locationId),
      getRelated(locationId),
      getBeforeAfter(locationId),
    ])
      .then((results) => {
        if (!active) return;
        const [
          location,
          stories,
          contributions,
          media,
          timeline,
          quiz,
          related,
          beforeAfter,
        ] = results;

        setData({
          location: location.data,
          stories: stories.data,
          contributions: contributions.data,
          media: media.data,
          timeline: timeline.data,
          quiz: quiz.data,
          related: related.data,
          beforeAfter: beforeAfter.data,
        });

        // One mock response is enough to make the whole page sample data.
        const fallback = results.find((result) => result.source === "mock");
        setSource(fallback ? "mock" : "backend");
        setReason(fallback?.reason);

        if (location.data) markVisited(location.data.id);
      })
      .catch((error) => { if (active) setReason(error instanceof Error ? error.message : "Location service unavailable."); })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // markVisited is stable; including it would re-run the fetch on every visit write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    if (tab !== "memories") return;
    data.contributions.forEach((contribution) => markMemoryUncovered(contribution.id));
  }, [data.contributions, tab]);

  if (loading) {
    return (
      <PageTransition>
        <div className="space-y-6">
          <SkeletonLine className="h-64 w-full rounded-3xl" />
          <SkeletonText lines={3} />
          <SkeletonLine className="h-8 w-full" />
          <SkeletonText lines={6} />
          <LoadingRegion label={isArabic ? "جارٍ تحميل المكان" : "Loading location"} />
        </div>
      </PageTransition>
    );
  }

  const { location } = data;

  if (import.meta.env.PROD && reason && !location) return (
    <PageTransition><DataSourceBanner source="backend" reason={reason} /></PageTransition>
  );

  if (!location) {
    return (
      <PageTransition>
        <div className="space-y-4">
          <h1 className="font-serif font-black text-3xl text-brand-olive">
            {isArabic ? "المكان غير موجود" : "Location not found"}
          </h1>
          <p className="text-sm text-brand-text">
            {isArabic ? "لا يوجد مكان بهذا المعرّف في الأرشيف: " : "There is no location with this id in the archive: "}
            <code className="font-mono" dir="ltr">{locationId}</code>
          </p>
          <Link
            to="/map"
            className="text-xs font-serif font-bold uppercase tracking-widest text-brand-olive hover:text-brand-amber inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {isArabic ? "العودة إلى الخريطة" : "Back to the map"}
          </Link>
        </div>
      </PageTransition>
    );
  }

  const profile = locationById(location.id);
  const governorateId = location.governorateId ?? "jerusalem";
  const isJerusalem = governorateId === "jerusalem";
  const nationalEntry = nationalRecord(location.id);
  const recordGap = (isArabic ? nationalEntry?.arabicGaps : nationalEntry?.gaps)
    || (isArabic ? catalog.gaps.ar : catalog.gaps.en);
  const mapPath = isJerusalem ? "/map" : `/governorates/${governorateId}/map`;
  const displayName = isArabic ? (profile?.arabicName ?? location.arabicName ?? location.name) : location.name;
  const secondaryName = isArabic ? location.name : (location.arabicName ?? profile?.arabicName);
  const description = isArabic ? (profile?.arabicSummary ?? location.description) : (profile?.summary ?? location.description);
  const reviewedWalkthrough = visitorWalkthrough(location.id, isArabic);

  const tabs: TabDefinition[] = [
    { id: "story", label: isArabic ? "الحكاية" : "Story", icon: BookOpen, badge: data.stories.length },
    { id: "guide", label: isArabic ? "اسأل" : "Ask", icon: Sparkles },
    { id: "timeline", label: isArabic ? "الخط الزمني" : "Timeline", icon: Milestone, badge: data.timeline.length },
    { id: "gallery", label: isArabic ? "الصور" : "Gallery", icon: ImageIcon, badge: data.media.length },
    { id: "quiz", label: isArabic ? "اختبر معرفتك" : "Quiz", icon: HelpCircle, badge: data.quiz.length },
    {
      id: "memories",
      label: isArabic ? "الذكريات" : "Memories",
      icon: MessageSquare,
      badge: data.contributions.length,
    },
    { id: "artisans", label: isArabic ? "دكاكين وحرف" : "Shops & crafts", icon: ShoppingBag },
  ];

  return (
    <PageTransition>
      <div className="space-y-8">
        <DataSourceBanner source={source} reason={reason} />

        <Link
          to={mapPath}
          className="text-xs font-serif font-bold uppercase tracking-widest text-brand-muted hover:text-brand-olive inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {isArabic ? "كل الأماكن" : "All locations"}
        </Link>

        {/* --- Header ------------------------------------------------------ */}
        <header className="relative rounded-3xl overflow-hidden border border-brand-border bg-brand-olive h-64">
          <CoverImage
            src={profile?.coverImage ?? location.coverImageUrl}
            alt={displayName}
            className="w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-olive/95 via-brand-olive/30 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <span className="text-[10px] text-brand-amber font-mono tracking-widest uppercase font-black">
              {isArabic ? `تراث ${governorateName(governorateId,true)} الحي` : `${governorateName(governorateId,false)} living heritage`}
              {hasVisited(location.id) && (isArabic ? " · تمّت الزيارة" : " · visited")}
            </span>
            <h1 className="font-serif font-black text-4xl text-stone-100 leading-tight">
              {displayName}
            </h1>
            {secondaryName && (
              <span className="font-serif text-base text-stone-300" dir={isArabic ? "ltr" : "rtl"}>
                {secondaryName}
              </span>
            )}
            {profile?.imageSourceUrl && (
              <a href={profile.imageSourceUrl} target="_blank" rel="noreferrer" className="absolute bottom-0 end-0 text-[9px] text-stone-300/90 bg-black/35 px-2 py-1 rounded-full inline-flex items-center gap-1 hover:text-white">
                <ExternalLink className="w-2.5 h-2.5" />{profile.imageCredit} · {profile.imageLicense}
              </a>
            )}
          </div>
        </header>

        {!isJerusalem && <p className="rounded-2xl bg-brand-amber/10 p-4 text-xs leading-relaxed text-brand-muted">{recordGap}</p>}
        <div className="space-y-5">
          {/* --- Facts ----------------------------------------------------- */}
          <section className="rounded-3xl border border-brand-border bg-white p-5 shadow-sm md:p-6">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-center">
              <div className="space-y-3 lg:col-span-7">
                <p className="text-sm leading-relaxed text-brand-text">
                  {description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {location.categories.map((category) => (
                    <span
                      key={category}
                      className="rounded-full border border-brand-border-light bg-brand-bg px-2.5 py-1 font-mono text-[10px] text-brand-muted"
                    >
                      {isArabic ? category : ({ "حارة تاريخية": "Historic quarter", "معلم ديني": "Sacred site", "سوق تراثي": "Historic souq", "حي مقدسي": "Jerusalem neighbourhood", "ذاكرة شفوية": "Oral memory", "متحف":"Museum", "تراث ثقافي":"Cultural heritage" }[category] ?? category)}
                    </span>
                  ))}
                </div>
              </div>

              <aside className="space-y-3 text-xs lg:col-span-5 lg:border-s lg:border-brand-border-light lg:ps-6">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted">
                    {isArabic ? "بيانات المكان" : "Record"}
                  </p>
                  <p className="flex items-center gap-2 text-brand-text">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
                    {isArabic ? `${nationalRecord(location.id)?.arabicCity ?? "القدس"}، فلسطين` : `${location.city}, ${location.country}`}
                  </p>
                  {location.latitude != null && location.longitude != null && (
                    <p className="font-mono text-brand-muted" dir="ltr">
                      {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isJerusalem && location.latitude != null && location.longitude != null && (
                    <button
                      type="button"
                      onClick={() => setRouteOpen(true)}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-olive px-4 py-2.5 font-bold text-white transition-colors hover:bg-[#4a4a35]"
                    >
                      <Navigation2 className="h-3.5 w-3.5 text-brand-amber" />
                      {isArabic ? "إرشادات المشي" : "Walking guide"}
                    </button>
                  )}
                  {data.stories.length > 0 && (
                    <p className="flex items-center gap-2 text-brand-muted">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {isArabic ? "نحو " : "About "}
                      {Math.max(
                        1,
                        Math.ceil(
                          (reviewedWalkthrough
                            ? reviewedWalkthrough.split(/\s+/).length
                            : data.stories.reduce(
                                (total, story) => total + story.simplifiedStory.split(/\s+/).length,
                                0,
                              )) / 200,
                        ),
                      )}{" "}
                      {isArabic ? " دقيقة قراءة" : " min of reading"}
                    </p>
                  )}
                </div>

                {(location.contentFile || location.aiSummaryFile) && (
                  <SourceCitationLine
                    sourceId={location.contentFile ?? location.aiSummaryFile}
                    locationId={location.id}
                    className="border-t border-brand-border-light pt-2"
                    compact
                  />
                )}
              </aside>
            </div>
          </section>

          {/* --- Tabs ------------------------------------------------------ */}
          <section>
          <Tabs tabs={tabs} active={tab} onChange={setTab} />

          <TabPanel id="story" active={tab}>
            <div className="space-y-8">
              {data.stories.length === 0 ? (
                <p className="text-xs text-brand-muted font-serif italic">
                  {isArabic ? "لم تُنشر حكاية مراجعة لهذا المكان بعد." : "No reviewed story has been published for this location yet."}
                </p>
              ) : (
                data.stories.map((story) => (
                  <article
                    key={story.id}
                    className="bg-white rounded-3xl border border-brand-border p-6 space-y-3 shadow-sm"
                  >
                    <h2 className="font-serif font-black text-xl text-brand-olive">
                      {isArabic ? (profile?.arabicStoryTitle ?? story.title) : (profile?.storyTitle ?? story.title)}
                    </h2>
                    {story.summary && (
                      <p className="text-xs text-brand-muted font-serif italic">
                        {isArabic ? (profile?.arabicSummary ?? story.summary) : (profile?.summary ?? story.summary)}
                      </p>
                    )}
                    <StoryNarrator
                      text={reviewedWalkthrough ?? (isArabic ? (profile?.arabicStory ?? story.simplifiedStory) : (profile?.story ?? story.simplifiedStory))}
                      summary={isArabic ? (profile?.arabicSummary ?? story.summary) : (profile?.summary ?? story.summary)}
                      timestamps={
                        !reviewedWalkthrough
                        && (isArabic ? !profile?.arabicStory : !profile?.story)
                          ? story.timestamps
                          : undefined
                      }
                      autoPlay={walkingTour}
                      locationId={location.id}
                    />
                    {story.source && (
                      <SourceCitationLine
                        sourceId={story.source}
                        locationId={location.id}
                        className="pt-2 border-t border-brand-border-light"
                      />
                    )}
                  </article>
                ))
              )}

              <div className="space-y-2">
                <h2 className="font-serif font-black text-2xl text-brand-olive flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-amber" />
                  {isArabic ? "احكِ لي الحكاية" : "Tell me the story"}
                </h2>
                <p className="text-xs text-brand-muted font-serif italic">
                  {isArabic ? "تُولَّد الحكاية من المحتوى المراجع لهذا المكان فقط." : "Generated from the reviewed content for this location only."}
                </p>
                <StoryWizard location={location} />
              </div>
            </div>
          </TabPanel>

          <TabPanel id="guide" active={tab}>
            <HeritageChat location={location} />
          </TabPanel>

          <TabPanel id="timeline" active={tab}>
            <HistoricalTimeline events={data.timeline} locationId={location.id} />
          </TabPanel>

          <TabPanel id="gallery" active={tab}>
            <div className="space-y-8">
              <div className="space-y-3">
                <h2 className="font-serif font-black text-xl text-brand-olive">
                  {isArabic ? "المكان بين الماضي والحاضر" : "Then and now"}
                </h2>
                <BeforeAfterSlider
                  data={data.beforeAfter}
                  fallbackImage={data.media.find((media) => media.era === "historical") ?? data.media[0] ?? null}
                />
              </div>
              <div className="space-y-3">
                <h2 className="font-serif font-black text-xl text-brand-olive">
                  {isArabic ? "الصور" : "Photographs"}
                </h2>
                <Gallery images={data.media} />
              </div>
            </div>
          </TabPanel>

          <TabPanel id="quiz" active={tab}>
            <HeritageQuiz questions={data.quiz} locationName={displayName} locationId={location.id} />
          </TabPanel>

          <TabPanel id="artisans" active={tab}>
            <LocalArtisansSection locationId={location.id} />
          </TabPanel>

          <TabPanel id="memories" active={tab}>
            <div className="space-y-4">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <p className="text-xs text-brand-muted font-serif italic">
                  {isArabic ? "ذكريات يشاركها الزوار والسكان وتُنشر بعد المراجعة." : "Contributed by visitors and residents, published after review."}
                </p>
                <Link
                  to={`/contribute?location=${location.id}`}
                  className="text-xs font-serif font-bold uppercase tracking-widest text-brand-olive hover:text-brand-amber inline-flex items-center gap-1.5"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  {isArabic ? "أضف ذكراك" : "Add yours"}
                </Link>
              </div>

              {data.contributions.length === 0 ? (
                <p className="text-xs text-brand-muted font-serif italic">
                  {isArabic ? "لم تُنشر ذكريات لهذا المكان بعد. قد تكون ذكراك الأولى." : "No memories have been published for this location yet. Yours could be the first."}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {data.contributions.map((contribution, index) => (
                    <motion.article
                      key={contribution.id}
                      tabIndex={0}
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
                      whileInView={{ opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true, margin: "-45px" }}
                      transition={{ duration: reduced ? 0.15 : 0.4, delay: reduced ? 0 : index * 0.06, ease: "easeOut" }}
                      whileHover={reduced ? undefined : { y: -4, scale: 1.01 }}
                      className="group relative space-y-2 overflow-hidden rounded-3xl border border-s-[3px] border-brand-border bg-white/80 p-5 shadow-sm transition-colors duration-300 hover:border-brand-amber/50 hover:border-s-brand-amber hover:bg-white hover:shadow-md focus:outline-none focus-visible:border-brand-amber focus-visible:shadow-md focus-visible:ring-2 focus-visible:ring-brand-amber/30"
                    >
                      <div className="flex items-start gap-2">
                        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true" />
                        <h3 className="font-serif font-bold text-base text-brand-olive">
                          {contribution.title}
                        </h3>
                      </div>
                      <p className="text-xs text-brand-text leading-relaxed">
                        {contribution.content}
                      </p>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-brand-muted pt-2 border-t border-brand-border-light">
                        {contribution.contributorName ?? (isArabic ? "مجهول" : "Anonymous")} ·{" "}
                        {new Date(contribution.submittedAt).toLocaleDateString(language === "ar" ? "ar-PS" : "en-GB")}
                      </p>
                    </motion.article>
                  ))}
                </div>
              )}
            </div>
          </TabPanel>
          </section>
        </div>

        {/* --- Related ------------------------------------------------------ */}
        {data.related.length > 0 && (
          <Reveal className="space-y-4">
            <h2 className="font-serif font-black text-2xl text-brand-olive">
              {isArabic ? "أماكن ذات صلة" : "Related places"}
            </h2>
            <p className="text-xs text-brand-muted font-serif italic">
              {isArabic ? `أماكن أخرى في الأرشيف تشترك في موضوع مع ${displayName}.` : `Other locations in the archive that share a theme with ${location.name}.`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.related.map((item) => (
                <LocationCard
                  key={item.id}
                  location={item}
                  visited={hasVisited(item.id)}
                />
              ))}
            </div>
          </Reveal>
        )}
      </div>
      <InAppWalkingRouteModal location={location} open={routeOpen} onClose={() => setRouteOpen(false)} />
    </PageTransition>
  );
};
