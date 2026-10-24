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

interface LocationCardProps {
  location: ApiLocation;
  /** Marks locations this browser has already opened. */
  visited?: boolean;
}

/** One count with its icon, hidden entirely when there is nothing to count. */
const Stat: React.FC<{
  icon: React.ElementType;
  value: number;
  label: string;
  suffix?: string;
}> = ({ icon: Icon, value, label, suffix }) => {
  if (!value) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-mono text-brand-muted"
      title={`${value} ${label}`}
    >
      <Icon className="w-3 h-3 text-brand-amber" />
      {value}
      {suffix}
    </span>
  );
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

  return <Link
    to={`/locations/${location.id}`}
    className="group bg-white rounded-3xl border border-brand-border overflow-hidden shadow-sm hover:shadow-xl hover:border-brand-amber/40 transition-all flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber"
  >
    <div className="relative h-44 bg-brand-olive overflow-hidden">
      <CoverImage
        src={image}
        alt={name}
        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-olive/90 via-brand-olive/10 to-transparent" />

      {visited && (
        <span className="absolute top-3 right-3 bg-white/90 text-brand-olive text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full inline-flex items-center gap-1">
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
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-muted flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-brand-amber" />
          {isArabic ? `${nationalRecord(location.id)?.arabicCity ?? "القدس"}، فلسطين` : `${location.city}, ${location.country}`}
        </p>
      )}

      <p className="text-xs text-brand-text leading-relaxed line-clamp-4 flex-1">
        {description}
      </p>

      {location.stats && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <Stat icon={BookOpen} value={location.stats.storyCount} label={isArabic ? "حكايات" : "stories"} />
          <Stat icon={Milestone} value={location.stats.timelineEventCount} label={isArabic ? "محطات زمنية" : "timeline entries"} />
          <Stat icon={ImageIcon} value={location.stats.imageCount} label={isArabic ? "صور" : "photographs"} />
          <Stat icon={MessageSquare} value={location.stats.memoryCount} label={isArabic ? "ذكريات" : "memories"} />
          <Stat
            icon={Clock}
            value={location.stats.readingTimeMinutes}
            label={isArabic ? "دقائق قراءة" : "minutes of reading"}
            suffix={isArabic ? " د قراءة" : " min read"}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {location.categories.map((category) => (
          <span
            key={category}
            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-bg border border-brand-border-light text-brand-muted"
          >
            {category}
          </span>
        ))}
      </div>

      <span className="text-xs font-serif font-bold uppercase tracking-widest text-brand-olive flex items-center gap-1.5 group-hover:text-brand-amber transition-colors">
        {isArabic ? "افتح المكان" : "Open location"}
        <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isArabic ? "rotate-180 group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`} />
      </span>
    </div>
  </Link>;
};
