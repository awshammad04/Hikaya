import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Milestone,
} from "lucide-react";
import { ApiLocation } from "../types";
import { CoverImage } from "./CoverImage";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById, nationalRecord } from "../data/heritage";
import { arabicCount, ArabicForms } from "../utils/plural";

interface LocationCardProps {
  location: ApiLocation;
  /** Marks locations this browser has already opened. */
  visited?: boolean;
}

/** One count with its icon and a readable label; hidden when it is zero. */
const Stat: React.FC<{
  icon: React.ElementType;
  value: number;
  text: string;
}> = ({ icon: Icon, value, text }) => {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
      <Icon className="w-3.5 h-3.5 text-brand-amber" aria-hidden="true" />
      {text}
    </span>
  );
};

const COUNT_FORMS: Record<string, { ar: ArabicForms; en: (n: number) => string }> = {
  stories: {
    ar: { one: "حكاية واحدة", two: "حكايتان", few: (n) => `${n} حكايات`, many: (n) => `${n} حكاية` },
    en: (n) => `${n} ${n === 1 ? "story" : "stories"}`,
  },
  timeline: {
    ar: { one: "محطة زمنية", two: "محطتان زمنيتان", few: (n) => `${n} محطات زمنية`, many: (n) => `${n} محطة زمنية` },
    en: (n) => `${n} timeline ${n === 1 ? "entry" : "entries"}`,
  },
  images: {
    ar: { one: "صورة واحدة", two: "صورتان", few: (n) => `${n} صور`, many: (n) => `${n} صورة` },
    en: (n) => `${n} photo${n === 1 ? "" : "s"}`,
  },
  memories: {
    ar: { one: "ذكرى واحدة", two: "ذكريان", few: (n) => `${n} ذكريات`, many: (n) => `${n} ذكرى` },
    en: (n) => `${n} ${n === 1 ? "memory" : "memories"}`,
  },
  minutes: {
    ar: { one: "دقيقة قراءة", two: "دقيقتا قراءة", few: (n) => `${n} دقائق قراءة`, many: (n) => `${n} دقيقة قراءة` },
    en: (n) => `${n} min read`,
  },
};

/**
 * Location summary card.
 *
 * The counts along the bottom answer "is there anything in here for me?" before
 * the reader commits to opening the page - how many stories, pictures, timeline
 * entries and memories, and roughly how long the reading takes.
 */
export const LocationCard: React.FC<LocationCardProps> = ({ location, visited }) => {
  const { isArabic } = useInterfaceLanguage();
  const profile = locationById(location.id);
  const name = isArabic ? (profile?.arabicName ?? location.arabicName ?? location.name) : location.name;
  const secondaryName = isArabic ? location.name : (location.arabicName ?? profile?.arabicName);
  const description = isArabic ? (profile?.arabicSummary ?? location.description) : (profile?.summary ?? location.description);
  const image = profile?.coverImage ?? location.coverImageUrl;
  const count = (kind: keyof typeof COUNT_FORMS, n: number) =>
    isArabic ? arabicCount(n, COUNT_FORMS[kind].ar) : COUNT_FORMS[kind].en(n);

  return <Link
    to={`/locations/${location.id}`}
    className="group bg-brand-surface rounded-3xl border border-brand-border overflow-hidden shadow-sm hover:shadow-xl hover:border-brand-amber/40 transition-all flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber"
  >
    <div className="relative h-44 bg-brand-olive overflow-hidden">
      <CoverImage
        src={image}
        alt={name}
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-olive/90 via-brand-olive/10 to-transparent" />

      {visited && (
        <span className="absolute top-3 end-3 bg-white/90 dark:bg-brand-surface/90 text-brand-olive text-xs font-mono uppercase tracking-wider px-2 py-1 rounded-full inline-flex items-center gap-1">
          <Check className="w-3 h-3" />
          {isArabic ? "استكشفتَه" : "Explored"}
        </span>
      )}

      <div className="absolute bottom-4 left-5 right-5">
        <h3 className="font-serif font-black text-2xl text-stone-100 leading-tight">
          {name}
        </h3>
        {secondaryName && (
          <span className="font-serif text-sm text-stone-300" dir={isArabic ? "ltr" : "rtl"}>
            {secondaryName}
          </span>
        )}
      </div>
    </div>

    <div className="p-5 space-y-3 flex-1 flex flex-col">
      {location.city && (
        <p className="text-xs font-mono uppercase tracking-widest text-brand-muted flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-brand-amber" />
          {isArabic ? `${nationalRecord(location.id)?.arabicCity ?? "القدس"}، فلسطين` : `${location.city}, ${location.country}`}
        </p>
      )}

      <p className="text-sm text-brand-text leading-relaxed line-clamp-4 flex-1">
        {description}
      </p>

      {location.stats && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <Stat icon={BookOpen} value={location.stats.storyCount} text={count("stories", location.stats.storyCount)} />
          <Stat icon={Milestone} value={location.stats.timelineEventCount} text={count("timeline", location.stats.timelineEventCount)} />
          <Stat icon={ImageIcon} value={location.stats.imageCount} text={count("images", location.stats.imageCount)} />
          <Stat icon={MessageSquare} value={location.stats.memoryCount} text={count("memories", location.stats.memoryCount)} />
          <Stat icon={Clock} value={location.stats.readingTimeMinutes} text={count("minutes", location.stats.readingTimeMinutes)} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {location.categories.map((category) => (
          <span
            key={category}
            className="text-xs font-mono px-2 py-0.5 rounded-full bg-brand-bg border border-brand-border-light text-brand-muted"
          >
            {category}
          </span>
        ))}
      </div>

      <span className="text-sm font-bold text-brand-olive flex items-center gap-1.5 group-hover:text-brand-amber transition-colors">
        {isArabic ? "افتح المكان" : "Open location"}
        <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isArabic ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`} />
      </span>
    </div>
  </Link>;
};
