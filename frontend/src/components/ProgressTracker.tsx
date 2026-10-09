import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Award, Compass, RotateCcw, Sparkles } from "lucide-react";
import { VisitedState } from "../hooks/useVisitedLocations";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorateName } from "../data/heritage";
import { openMyJerusalemStory } from "../services/progress";

/**
 * Shows how much of the archive this browser has opened, plus the badges earned.
 *
 * The wording is careful: it counts locations *in the archive*, not places in
 * Palestine. The archive holds three sites, so a bar reading "33% of Palestine
 * explored" would be a nonsense claim - and the whole project rests on not
 * making claims the records do not support.
 */
export const ProgressTracker: React.FC<{ state: VisitedState; scope?: string; onOpenStory?: () => void }> = ({ state, scope = "jerusalem", onOpenStory }) => {
  const { isArabic } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const { visited, total, percentComplete, badges } = state;

  if (total === 0) return null;

  return (
    <section className="bg-white rounded-3xl border border-brand-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-serif font-black text-lg text-brand-olive flex items-center gap-2">
            <Compass className="w-4 h-4 text-brand-amber" />
            {isArabic ? `استكشافك لـ${governorateName(scope,true)}` : "Your exploration"}
          </h3>
          <p className="text-xs text-brand-muted">
            {isArabic ? `فتحت ${visited.length} من ${total} أماكن في الدليل. يُحفظ التقدم على هذا الجهاز فقط.` : `${visited.length} of ${total} location${total === 1 ? "" : "s"} in the archive opened. Kept on this device only.`}
          </p>
        </div>
        <span className="font-serif font-black text-3xl text-brand-olive">
          {percentComplete}%
        </span>
      </div>

      <div
        className="h-2 w-full rounded-full bg-brand-bg overflow-hidden"
        role="progressbar"
        aria-valuenow={percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={isArabic ? "الأماكن المفتوحة" : "Locations opened"}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-brand-olive to-brand-amber"
          initial={{ width: 0 }}
          animate={{ width: `${percentComplete}%` }}
          transition={{ duration: reduced ? 0 : 0.8, ease: "easeOut" }}
        />
      </div>

      <button
        type="button"
        onClick={onOpenStory ?? openMyJerusalemStory}
        className="w-full rounded-2xl border border-brand-amber/35 bg-brand-amber/10 px-4 py-3 text-xs font-bold text-brand-olive transition hover:border-brand-amber hover:bg-brand-amber/15 inline-flex items-center justify-center gap-2"
      >
        <Sparkles className="h-4 w-4 text-brand-amber" />
        {isArabic ? `إنشاء حكايتي في ${governorateName(scope,true)}` : `Create My Story in ${governorateName(scope,false)}`}
      </button>

      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge.id}
            title={scope === 'jerusalem' ? badge.description : (isArabic ? `التقدم في أرشيف ${governorateName(scope,true)}` : `Progress through the ${governorateName(scope,false)} archive`)}
            className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition-colors ${
              badge.earned
                ? "bg-brand-amber/10 border-brand-amber/30 text-brand-amber"
                : "bg-brand-bg border-brand-border-light text-brand-muted opacity-70"
            }`}
          >
            <Award className="w-3 h-3" />
            {scope === 'jerusalem' ? (isArabic ? ({ "first-step": "الخطوة الأولى", wanderer: "راوي القدس", archivist: "حارس حكاية" }[badge.id] ?? badge.label) : badge.label) : (isArabic ? ({'first-step':'الخطوة الأولى',wanderer:`راوي ${governorateName(scope,true)}`,archivist:'حارس حكاية'}[badge.id] ?? badge.label) : ({'first-step':'First step',wanderer:`${governorateName(scope,false)} storyteller`,archivist:'Hikaya archivist'}[badge.id] ?? badge.label))}
            {!badge.earned && ` · ${badge.threshold}`}
          </span>
        ))}

        {visited.length > 0 && (
          <button
            type="button"
            onClick={state.reset}
            className="text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-brand-border-light text-brand-muted hover:text-brand-olive hover:border-brand-olive inline-flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {isArabic ? "إعادة التعيين" : "Reset"}
          </button>
        )}
      </div>
    </section>
  );
};
