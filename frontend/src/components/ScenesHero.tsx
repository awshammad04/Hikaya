import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpLeft, Camera, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById } from "../data/heritage";
import { ApiLocation } from "../types";

export interface Scene {
  /** The place the scene opens. */
  id: string;
  image: string;
  arTitle: string;
  enTitle: string;
  arCaption: string;
  enCaption: string;
  position: string;
}

const JERUSALEM_SCENES: Scene[] = [
  {
    id: "at-tur",
    image: "/images/jerusalem/at-tur.jpg",
    arTitle: "القدس من جبل الزيتون",
    enTitle: "Jerusalem from the Mount of Olives",
    arCaption: "مشهد بانورامي للبلدة القديمة وقبة الصخرة من السفح الشرقي.",
    enCaption: "The Old City and the Dome of the Rock seen from the eastern ridge.",
    position: "50% 48%",
  },
  {
    id: "bab-al-amud",
    image: "/images/jerusalem/bab-al-amud.jpg",
    arTitle: "باب العامود",
    enTitle: "Bab al-Amud",
    arCaption: "البوابة الشمالية للبلدة القديمة وساحتها المقدسية الحيّة.",
    enCaption: "The Old City’s northern gate and its living Jerusalemite square.",
    position: "54% 48%",
  },
  {
    id: "muslim-quarter",
    image: "/images/jerusalem/muslim-quarter.jpg",
    arTitle: "أسواق حارة المسلمين",
    enTitle: "Markets of the Muslim Quarter",
    arCaption: "عقود حجرية ودكاكين مضاءة على الطريق إلى المسجد الأقصى.",
    enCaption: "Stone vaults and illuminated shops along routes toward Al-Aqsa.",
    position: "50% 56%",
  },
  {
    id: "silwan",
    image: "/images/jerusalem/silwan.jpg",
    arTitle: "سلوان وواديها",
    enTitle: "Silwan and its valley",
    arCaption: "بيوت الحجر والبساتين المدرّجة وذاكرة عين سلوان.",
    enCaption: "Stone homes, terraced slopes and the memory of Silwan spring.",
    position: "50% 57%",
  },
  {
    id: "armenian-quarter",
    image: "/images/jerusalem/armenian-quarter.jpg",
    arTitle: "حارة الأرمن",
    enTitle: "The Armenian Quarter",
    arCaption: "تفاصيل فنية وطقسية من الحضور الأرمني العريق في القدس.",
    enCaption: "Artistic and devotional detail from Jerusalem’s enduring Armenian presence.",
    position: "50% 48%",
  },
  {
    id: "christian-quarter",
    image: "/images/jerusalem/christian-quarter.jpg",
    arTitle: "حارة النصارى",
    enTitle: "The Christian Quarter",
    arCaption: "كنائس وأديرة وأسواق حجرية تتجمع حول كنيسة القيامة والمورستان.",
    enCaption: "Churches, monasteries and stone markets gathered around the Holy Sepulchre and Muristan.",
    position: "50% 48%",
  },
  {
    id: "maghariba-quarter",
    image: "/images/jerusalem/maghariba-quarter.jpg",
    arTitle: "ذاكرة حارة المغاربة",
    enTitle: "Memory of the Maghariba Quarter",
    arCaption: "سجل بصري للحارة الفلسطينية التاريخية بجوار حائط البراق قبل هدمها سنة 1967.",
    enCaption: "A visual record of the historic Palestinian quarter beside al-Buraq Wall before its 1967 demolition.",
    position: "50% 52%",
  },
  {
    id: "sheikh-jarrah",
    image: "/images/jerusalem/sheikh-jarrah.jpg",
    arTitle: "الشيخ جراح",
    enTitle: "Sheikh Jarrah",
    arCaption: "بيوت الحجر والحدائق وذاكرة العائلات المقدسية في حي ما زال حياً.",
    enCaption: "Stone homes, gardens and Jerusalemite family memory in a living neighbourhood.",
    position: "50% 50%",
  },
];

/**
 * The photographs a governorate opens with: Jerusalem's curated set, and for
 * the others the credited cover photograph of each place.
 */
export function scenesFor(governorateId: string, locations: ApiLocation[]): Scene[] {
  if (governorateId === "jerusalem") return JERUSALEM_SCENES;
  return locations.flatMap((location) => {
    const profile = locationById(location.id);
    const image = profile?.coverImage || location.coverImageUrl;
    if (!image) return [];
    return [{
      id: location.id,
      image,
      arTitle: profile?.arabicName ?? location.arabicName ?? location.name,
      enTitle: location.name,
      arCaption: profile?.arabicSummary ?? location.description ?? "",
      enCaption: profile?.summary ?? location.description ?? "",
      position: "50% 50%",
    }];
  });
}

interface ScenesHeroProps {
  scenes: Scene[];
  /** Names the carousel, for example "Scenes from Nablus". */
  arLabel: string;
  enLabel: string;
  children: React.ReactNode;
}

/** A full-bleed photographic introduction to a governorate. */
export const ScenesHero: React.FC<ScenesHeroProps> = ({ scenes, arLabel, enLabel, children }) => {
  const { isArabic } = useInterfaceLanguage();
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const active = scenes[activeIndex % Math.max(scenes.length, 1)];
  const several = scenes.length > 1;

  useEffect(() => {
    if (reducedMotion || !playing || !several) return;
    const timer = window.setInterval(
      () => setActiveIndex((current) => (current + 1) % scenes.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion, several, scenes.length]);

  const move = (direction: -1 | 1) => {
    setActiveIndex((current) => (current + direction + scenes.length) % scenes.length);
  };

  return (
    <section
      className="relative isolate min-h-[560px] overflow-hidden rounded-3xl bg-brand-olive shadow-xl lg:min-h-[520px]"
      style={active ? {
        backgroundImage: `url(${active.image})`,
        backgroundPosition: active.position,
        backgroundSize: "cover",
      } : undefined}
      aria-roledescription={several ? "carousel" : undefined}
      aria-label={isArabic ? arLabel : enLabel}
    >
      {!active && <div className="absolute inset-0 tatreez-grid opacity-10" aria-hidden="true" />}
      <AnimatePresence initial={false} mode="sync">
        {active && (
          <motion.img
            key={active.image}
            src={active.image}
            alt={isArabic ? active.arTitle : active.enTitle}
            className="absolute max-w-none object-cover"
            style={{
              inset: "-2px",
              width: "calc(100% + 4px)",
              height: "calc(100% + 4px)",
              objectPosition: active.position,
            }}
            initial={{ opacity: 0, scale: reducedMotion ? 1 : 1.035 }}
            animate={{ opacity: 1, scale: reducedMotion ? 1 : 1.075 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.8, ease: "easeOut" },
              scale: { duration: 7, ease: "linear" },
            }}
          />
        )}
      </AnimatePresence>

      <div
        className="absolute inset-0"
        style={{
          background: isArabic
            ? "linear-gradient(to left, rgba(20,25,18,.82) 0%, rgba(20,25,18,.4) 50%, rgba(20,25,18,.05) 100%)"
            : "linear-gradient(to right, rgba(20,25,18,.82) 0%, rgba(20,25,18,.4) 50%, rgba(20,25,18,.05) 100%)",
        }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#172019]/60 via-transparent to-transparent" aria-hidden="true" />

      <div className="relative z-10 grid min-h-[560px] grid-cols-1 items-center gap-8 p-7 sm:p-10 lg:min-h-[520px] lg:grid-cols-12 lg:p-12">
        {children}

        {active && (
          <div className="self-end lg:col-span-5">
            <div className="max-w-md rounded-2xl border border-white/20 bg-black/25 p-5 shadow-2xl backdrop-blur-md sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-[0.18em] text-white/85">
                  <Camera className="h-3 w-3 text-brand-amber-light" aria-hidden="true" />
                  {isArabic ? arLabel : enLabel}
                </span>
                {several && (
                  <button
                    type="button"
                    onClick={() => setPlaying((current) => !current)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-brand-surface hover:text-brand-olive focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber"
                    aria-label={playing ? (isArabic ? "إيقاف العرض التلقائي" : "Pause slideshow") : (isArabic ? "تشغيل العرض التلقائي" : "Play slideshow")}
                  >
                    {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
                  transition={{ duration: 0.35 }}
                >
                  {several && (
                    <p className="mb-2 text-xs font-mono font-bold uppercase tracking-[0.18em] text-brand-amber-light">
                      {String(activeIndex + 1).padStart(2, "0")} — {String(scenes.length).padStart(2, "0")}
                    </p>
                  )}
                  <h2 className="font-serif text-2xl font-black leading-tight text-white sm:text-3xl">
                    {isArabic ? active.arTitle : active.enTitle}
                  </h2>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/75 line-clamp-2">
                    {isArabic ? active.arCaption : active.enCaption}
                  </p>
                  <Link
                    to={`/locations/${active.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 border-b border-brand-amber-light pb-1 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:text-brand-amber-light"
                  >
                    {isArabic ? "افتح المكان" : "Open the place"}
                    <ArrowUpLeft className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </motion.div>
              </AnimatePresence>

              {several && (
                <div className="mt-5 border-t border-white/15 pt-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 items-center gap-1.5 overflow-hidden" aria-label={isArabic ? "اختر مشهداً" : "Choose a scene"}>
                    {scenes.map((scene, index) => (
                      <button
                        type="button"
                        key={scene.id}
                        onClick={() => setActiveIndex(index)}
                        className={`h-0.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber ${
                          index === activeIndex ? "w-8 bg-brand-amber-light" : "w-4 bg-white/40 hover:bg-white/80"
                        }`}
                        aria-label={isArabic ? scene.arTitle : scene.enTitle}
                        aria-current={index === activeIndex ? "true" : undefined}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex shrink-0 items-center justify-end gap-2 sm:mt-0">
                    <button
                      type="button"
                      onClick={() => move(-1)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber"
                      aria-label={isArabic ? "المشهد السابق" : "Previous scene"}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(1)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber"
                      aria-label={isArabic ? "المشهد التالي" : "Next scene"}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
