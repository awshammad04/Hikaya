import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
} from "lucide-react";
import { ApiLocation } from "../types";
import { CoverImage } from "./CoverImage";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById, nationalRecord } from "../data/heritage";
import { arabicCount, ArabicForms } from "../utils/plural";
import { categoryLabel } from "../utils/categories";

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
  images: {
    ar: { one: "صورة واحدة", two: "صورتان", few: (n) => `${n} صور`, many: (n) => `${n} صورة` },
    en: (n) => `${n} photo${n === 1 ? "" : "s"}`,
  },
  memories: {
    ar: { one: "ذكرى واحدة", two: "ذكريان", few: (n) => `${n} ذكريات`, many: (n) => `${n} ذكرى` },
    en: (n) => `${n} ${n === 1 ? "memory" : "memories"}`,
  },
};

/**
 * Location summary card.
 *
 * Only the counts that differ between places are shown: photographs, and the
 * memories visitors have shared. Every place has one story and a short read,
 * so repeating those on each card would add noise, not information.
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
          <Stat icon={ImageIcon} value={location.stats.imageCount} text={count("images", location.stats.imageCount)} />
          <Stat icon={MessageSquare} value={location.stats.memoryCount} text={count("memories", location.stats.memoryCount)} />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {location.categories.map((category) => (
          <span
            key={category}
            className="text-xs font-mono px-2 py-0.5 rounded-full bg-brand-bg border border-brand-border-light text-brand-muted"
          >
            {categoryLabel(category, isArabic)}
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
