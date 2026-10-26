import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Shuffle } from "lucide-react";
import { FeaturedStory } from "../types";
import { CoverImage } from "./CoverImage";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById } from "../data/heritage";
import { visitorWalkthrough } from "../visitorWalkthroughs";
import { SourceCitationLine } from "./SourceCitationLine";
import { readableNarrative } from "../utils/plainText";
import { LoadingRegion, SkeletonLine } from "./Skeleton";
import { Reveal } from "./motion";
import { useFeaturedStory } from "../hooks/useFeaturedStory";

interface FeaturedStoryCardProps {
  featured: FeaturedStory;
  /** Shows another story. Absent when there is nothing else to show. */
  onShuffle?: () => void;
  shuffling?: boolean;
}

/**
 * First ~55 words, so the card gives a taste without becoming the page.
 * Section headings ("What to notice") are left out: flattened into one line
 * they would run straight into the sentence that follows them.
 */
function excerpt(text: string, words = 55): string {
  const { text: plain, headings } = readableNarrative(text);
  const body = plain
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !headings.has(line))
    .filter((line) => line.split(/\s+/).length > 6 || /[.؟?!،,;؛…:]$/.test(line))
    .join(" ");
  const tokens = body.replace(/\s+/g, " ").trim().split(" ");
  return tokens.length <= words
    ? tokens.join(" ")
    : `${tokens.slice(0, words).join(" ")}…`;
}

/**
 * The story of the day, on the home page.
 *
 * Labelled "Story of the day" rather than "On this day": the reviewed content
 * dates events to a year at best, so an anniversary claim would be a precision
 * the records cannot support. What it actually is - the same story for everyone,
 * changing daily - is what it says.
 */
export const FeaturedStoryCard: React.FC<FeaturedStoryCardProps> = ({
  featured,
  onShuffle,
  shuffling,
}) => {
  const { story, location, reason } = featured;
  const { isArabic } = useInterfaceLanguage();
  const profile = location ? locationById(location.id) : undefined;
  const title = isArabic ? (profile?.arabicStoryTitle ?? story.title) : (profile?.storyTitle ?? story.title);
  const storyText = location
    ? (visitorWalkthrough(location.id, isArabic) ?? (isArabic ? (profile?.arabicStory ?? story.simplifiedStory) : (profile?.story ?? story.simplifiedStory)))
    : story.simplifiedStory;
  const locationName = isArabic ? (profile?.arabicName ?? location?.arabicName ?? location?.name) : location?.name;

  return (
    <article className="bg-brand-surface rounded-3xl border border-brand-border overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-5">
      <div className="relative md:col-span-2 min-h-[190px] bg-brand-olive">
        <CoverImage
          src={profile?.coverImage ?? location?.coverImageUrl}
          alt={locationName ?? title}
          className="w-full h-full object-cover absolute inset-0"
        />
        <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-brand-olive/90 to-transparent" />
      </div>

      <div className="md:col-span-3 p-6 space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-brand-amber flex items-center gap-1.5">
          {reason === "random" ? (
            <>
              <Shuffle className="w-3 h-3" />
              {isArabic ? "حكاية من الأرشيف" : "A story from the archive"}
            </>
          ) : (
            <>
              <CalendarDays className="w-3 h-3" />
              {isArabic ? "حكاية اليوم" : "Story of the day"}
            </>
          )}
        </p>

        <h3 className="font-serif font-black text-2xl text-brand-olive leading-tight">
          {title}
        </h3>

        {location && (
          <p className="text-xs text-brand-muted font-serif italic">
            {locationName}
            {isArabic ? <span dir="ltr"> · {location.name}</span> : (location.arabicName ? ` · ${location.arabicName}` : "")}
          </p>
        )}

        <p className="text-sm text-brand-text leading-relaxed">
          {excerpt(storyText)}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {location && (
            <Link
              to={`/locations/${location.id}`}
              className="bg-brand-olive hover:bg-brand-olive-deep text-brand-bg text-xs font-serif font-black tracking-widest uppercase px-5 py-2.5 rounded-full inline-flex items-center gap-2 transition-colors"
            >
              {isArabic ? "اقرأ الحكاية" : "Read it"}
              <ArrowRight className="w-3.5 h-3.5 text-brand-amber" />
            </Link>
          )}

          {onShuffle && (
            <button
              type="button"
              onClick={onShuffle}
              disabled={shuffling}
              className="border border-brand-border hover:border-brand-amber disabled:opacity-50 text-brand-olive text-xs font-serif font-black tracking-widest uppercase px-5 py-2.5 rounded-full inline-flex items-center gap-2 transition-colors"
            >
              <Shuffle className={`w-3.5 h-3.5 ${shuffling ? "animate-spin" : ""}`} />
              {isArabic ? "حكاية أخرى" : "Surprise me"}
            </button>
          )}
        </div>

        {story.source && (
          <SourceCitationLine sourceId={story.source} locationId={location?.id} className="pt-1" compact />
        )}
      </div>
    </article>
  );
};

/**
 * The "Story of the day" section: heading, a skeleton while it loads, then
 * the card. Hands its load error up so the page's data banner can show it.
 */
export const StoryOfTheDay: React.FC<{ story: ReturnType<typeof useFeaturedStory> }> = ({ story }) => {
  const { isArabic } = useInterfaceLanguage();
  const { featured, loading, shuffling, shuffle } = story;
  if (!loading && !featured) return null;
  return (
    <Reveal className="space-y-4">
      <h2 className="font-serif font-black text-2xl text-brand-olive">
        {isArabic ? "حكاية اليوم" : "Story of the day"}
      </h2>
      {loading ? (
        <div className="bg-brand-surface rounded-3xl border border-brand-border overflow-hidden grid grid-cols-1 md:grid-cols-5">
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
        featured && <FeaturedStoryCard featured={featured} onShuffle={shuffle} shuffling={shuffling} />
      )}
    </Reveal>
  );
};
