import React, { useRef, useState } from "react";
import {
  motion,
  MotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { BookMarked, CalendarDays, Info } from "lucide-react";
import { ApiTimelineEvent } from "../types";
import { SkeletonLine, SkeletonText } from "./Skeleton";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { localizeTimeline } from "../arabicContent";
import { localizeNationalTimeline } from "../data/heritage";
import { SourceCitationLine } from "./SourceCitationLine";

interface HistoricalTimelineProps {
  events: ApiTimelineEvent[];
  locationId?: string;
  loading?: boolean;
}

interface AnimatedTimelineProps {
  events: ApiTimelineEvent[];
  isArabic: boolean;
}

interface TimelineMilestoneProps {
  event: ApiTimelineEvent;
  index: number;
  total: number;
  isArabic: boolean;
  reduced: boolean | null;
  scrollProgress: MotionValue<number>;
  flowProgress: MotionValue<number>;
}

const TimelineMilestone: React.FC<TimelineMilestoneProps> = ({
  event,
  index,
  total,
  isArabic,
  reduced,
  scrollProgress,
  flowProgress,
}) => {
  // Every milestone owns a stable threshold along the complete timeline. Once
  // progress passes it, the item remains revealed even after leaving through
  // the top. Reversing upward below the threshold retracts only future items.
  const step = total > 1 ? 0.92 / (total - 1) : 0.92;
  const threshold = total > 1 ? 0.04 + index * step : 0.12;
  const revealDistance = Math.min(0.075, step * 0.42);
  const rawVisibility = useTransform(scrollProgress, (value: number) => {
    if (reduced) return 1;
    return Math.min(1, Math.max(0, (value - (threshold - revealDistance)) / revealDistance));
  });
  const visibility = useSpring(rawVisibility, {
    stiffness: 220,
    damping: 28,
    mass: 0.3,
  });
  const y = useTransform(visibility, [0, 1], [24, 0]);
  const scale = useTransform(visibility, [0, 1], [0.98, 1]);
  const blur = useTransform(visibility, [0, 1], ["blur(2px)", "blur(0px)"]);
  const dotScale = useTransform(visibility, [0, 1], [0, 1]);
  const activeStrength = useTransform(flowProgress, (value: number) => {
    if (reduced) return 0;
    const radius = Math.max(0.055, step * 0.48);
    return Math.max(0, 1 - Math.abs(value - threshold) / radius);
  });
  const nextThreshold = index < total - 1 ? threshold + step : 1;
  const latchDistance = Math.min(0.068, step * 0.36);
  const latchedTail = 0.075;
  const segmentProgress = useTransform(flowProgress, (value: number) => {
    if (reduced) return 1;
    if (value < threshold) return 0;
    const releasePoint = threshold + latchDistance;
    if (value <= releasePoint) return latchedTail;
    const travelled = Math.min(
      1,
      (value - releasePoint) / Math.max(0.001, nextThreshold - releasePoint),
    );
    // After the explicit collision hold, slow acceleration preserves a sense
    // of weight as the spring-driven line leaves the station.
    const kineticTravel = Math.pow(travelled, 1.45);
    return latchedTail + kineticTravel * (1 - latchedTail);
  });
  const initialLatch = Boolean(reduced) || (flowProgress.get() as number) >= threshold;
  const [latched, setLatched] = useState(initialLatch);
  const [impactVersion, setImpactVersion] = useState(0);
  const latchedRef = useRef(initialLatch);
  const progressInitialized = useRef(false);
  const releaseThreshold = threshold - Math.min(0.018, step * 0.1);

  useMotionValueEvent(flowProgress, "change", (value: number) => {
    const next = Boolean(reduced)
      ? true
      : latchedRef.current
        ? value >= releaseThreshold
        : value >= threshold;

    // The first measurement may jump to the page's existing scroll position;
    // synchronise silently so old nodes do not all fire impact waves at once.
    if (!progressInitialized.current) {
      progressInitialized.current = true;
      latchedRef.current = next;
      setLatched(next);
      return;
    }

    if (next === latchedRef.current) return;
    const wasLatched = latchedRef.current;
    latchedRef.current = next;
    setLatched(next);
    if (!wasLatched && next && !reduced) {
      setImpactVersion((current) => current + 1);
    }
  });

  return (
    <motion.li
      className="relative ps-10"
      style={{ opacity: visibility, y, scale, filter: blur }}
    >
      {index < total - 1 && (
        <>
          <span
            aria-hidden="true"
            className="absolute -bottom-12 start-[7px] top-7 z-0 w-0.5 rounded-full bg-brand-border-light"
          />
          <motion.span
            aria-hidden="true"
            className="absolute -bottom-12 start-[7px] top-7 z-[1] w-0.5 origin-top rounded-full bg-gradient-to-b from-brand-amber via-brand-amber to-brand-olive"
            style={{ scaleY: segmentProgress }}
          />
        </>
      )}

      <motion.span
        className="absolute start-0 top-5 z-20 grid h-4 w-4 place-items-center"
        style={{ opacity: visibility, scale: dotScale }}
        aria-hidden="true"
      >
        <motion.span
          className="absolute -inset-2 rounded-full bg-brand-amber/15"
          style={{ opacity: activeStrength }}
        >
          <motion.span
            className="absolute inset-0 rounded-full bg-brand-amber/30"
            animate={reduced ? undefined : { scale: [0.95, 1.22, 0.95], opacity: [0.2, 0.38, 0.2] }}
            transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.span>
        {impactVersion > 0 && !reduced && (
          <motion.span
            key={impactVersion}
            className="absolute -inset-1 rounded-full border-2 border-brand-amber/60"
            initial={{ scale: 0.72, opacity: 0.78 }}
            animate={{ scale: 2.3, opacity: 0 }}
            transition={{ duration: 0.64, ease: "easeOut" }}
          />
        )}
        <motion.span
          className="relative h-4 w-4 rounded-full border-2 border-brand-bg ring-[3px] ring-brand-bg transition-colors duration-100"
          animate={
            reduced
              ? { scale: 1, backgroundColor: "#d97706" }
              : latched
                ? { scale: [1, 0.9, 1.5, 0.98, 1], backgroundColor: "#d97706" }
                : { scale: 1, backgroundColor: "#8a8a80" }
          }
          transition={latched && !reduced ? { duration: 0.58, times: [0, 0.16, 0.48, 0.76, 1], ease: "easeOut" } : { duration: 0.18 }}
        />
      </motion.span>

      <div className="relative overflow-hidden rounded-2xl border border-s-[3px] border-brand-border-light border-s-brand-amber/70 bg-brand-surface p-4 shadow-[0_8px_24px_rgba(73,70,45,0.09)]">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="inline-flex items-center gap-1.5 rounded-full border border-brand-amber/30 bg-brand-amber/10 px-2.5 py-1 font-serif text-xs font-bold text-brand-olive">
            <CalendarDays className="h-3.5 w-3.5 text-brand-amber" aria-hidden="true" />
            {event.periodLabel}
          </h4>
          {event.isTradition && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-amber/30 bg-brand-amber/10 px-2 py-1 font-mono text-xs uppercase tracking-wider text-brand-amber shadow-[0_0_16px_rgba(217,119,6,0.16)]">
              <BookMarked className="h-3 w-3" aria-hidden="true" />
              {isArabic ? "رواية تقليدية" : "Tradition"}
            </span>
          )}
        </div>

        <p className="mt-2 text-xs leading-relaxed text-brand-text">
          {event.description}
        </p>
      </div>
    </motion.li>
  );
};

const AnimatedTimeline: React.FC<AnimatedTimelineProps> = ({ events, isArabic }) => {
  const reduced = useReducedMotion();
  const timelineRef = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start 75%", "end 35%"],
  });
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 130,
    damping: 20,
    mass: 0.35,
    restDelta: 0.001,
  });
  const introProgress = useTransform(smoothProgress, [0, 0.04], [0, 1]);

  return (
    <ol ref={timelineRef} className="relative ms-1 space-y-5 py-1">
      <span
        aria-hidden="true"
        className="absolute start-[7px] top-1 h-7 w-0.5 rounded-full bg-brand-border-light"
      />
      <motion.span
        aria-hidden="true"
        className="absolute start-[7px] top-1 z-[1] h-7 w-0.5 origin-top rounded-full bg-gradient-to-b from-brand-olive to-brand-amber"
        style={reduced ? { scaleY: 1 } : { scaleY: introProgress }}
      />

      {events.map((event, index) => (
        <TimelineMilestone
          key={event.id}
          event={event}
          index={index}
          total={events.length}
          isArabic={isArabic}
          reduced={reduced}
          scrollProgress={scrollYProgress}
          flowProgress={smoothProgress}
        />
      ))}
    </ol>
  );
};

/**
 * The historical timeline for a location.
 *
 * Entries appear in the order the reviewed content file gives them, which the
 * documentation team writes chronologically. Anything resting on religious or
 * oral tradition is marked as such rather than being blended into the record -
 * the same separation the content files and the AI module keep.
 */
export const HistoricalTimeline: React.FC<HistoricalTimelineProps> = ({
  events,
  locationId,
  loading,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const displayedEvents = events.map((event) => localizeNationalTimeline(localizeTimeline(event, isArabic), isArabic));

  if (loading) {
    return (
      <div className="space-y-6 pl-6">
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-2">
            <SkeletonLine className="h-3 w-40" />
            <SkeletonText lines={2} />
          </div>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className="text-xs text-brand-muted font-serif italic">
        {isArabic ? "لم يُوثق خط زمني لهذا المكان بعد." : "No timeline has been documented for this location yet."}
      </p>
    );
  }

  const traditionCount = events.filter((event) => event.isTradition).length;
  const sourceFile = events.find((event) => event.sourceFile)?.sourceFile;

  return (
    <div className="space-y-5">
      {traditionCount > 0 && (
        <p className="text-xs text-brand-text bg-brand-bg border border-brand-border-light rounded-2xl px-4 py-3 flex items-start gap-2 leading-relaxed">
          <Info className="w-4 h-4 text-brand-amber shrink-0 mt-0.5" />
          <span>
            {isArabic
              ? `تعتمد ${traditionCount} من أصل ${events.length} محطات على تقليد ديني أو شفوي لا على توثيق تاريخي مباشر. وُسمت بوضوح وأُبقيت لأن التقليد جزء من السجل أيضاً.`
              : `${traditionCount} of these ${events.length} entries rest on religious or oral tradition rather than documented history. They are marked, and kept in place rather than removed — the tradition is part of the record too.`}
          </span>
        </p>
      )}

      <AnimatedTimeline events={displayedEvents} isArabic={isArabic} />

      {sourceFile && (
        <SourceCitationLine sourceId={sourceFile} locationId={locationId} className="pt-1" />
      )}
    </div>
  );
};
