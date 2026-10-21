import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import { ApiLocation, AudienceMode, GeneratedStory, StoryTone } from "../types";
import { generateStory } from "../services/api";
import { StoryNarrator } from "./StoryNarrator";
import { TransparencyPanel } from "./TransparencyPanel";
import { SourceCitationLine } from "./SourceCitationLine";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById } from "../data/heritage";
import { visitorWalkthrough } from "../visitorWalkthroughs";

interface StoryWizardProps {
  location: ApiLocation;
  /** Starts reading aloud as soon as a story is generated. */
  autoPlay?: boolean;
}

const AUDIENCES = [
  { value: "student" as const, en: "Student", ar: "طالب", enHint: "Cause, chronology, vocabulary and takeaway", arHint: "أسباب وتسلسل زمني ومصطلحات وخلاصة" },
  { value: "tourist" as const, en: "Tourist", ar: "زائر", enHint: "A spatial, sensory walk with practical tips", arHint: "جولة مكانية حسية مع إرشادات عملية" },
  { value: "child" as const, en: "Child", ar: "طفل", enHint: "A warm journey of simple discoveries", arHint: "رحلة دافئة واكتشافات بلغة بسيطة" },
  { value: "historian" as const, en: "Historian", ar: "باحث في التاريخ", enHint: "Evidence, layers, chronology and documented limits", arHint: "أدلة وطبقات وتسلسل وحدود التوثيق" },
  { value: "short" as const, en: "In brief", ar: "باختصار", enHint: "A focused 3–5 sentence briefing", arHint: "خلاصة مركزة من 3–5 جمل" },
  { value: "general" as const, en: "Anyone", ar: "للقارئ العام", enHint: "Balanced", arHint: "سرد متوازن" },
];

const TONES = [
  { value: "storytelling" as const, en: "Storytelling", ar: "حكائي", enHint: "Flows like a story", arHint: "ينساب كالحكاية" },
  { value: "educational" as const, en: "Explanatory", ar: "تفسيري", enHint: "As a teacher would", arHint: "بلغة تعليمية واضحة" },
  { value: "emotional" as const, en: "Warm", ar: "دافئ", enHint: "Feeling, without overstating", arHint: "وجداني من دون مبالغة" },
  { value: "neutral" as const, en: "Plain", ar: "مباشر", enHint: "Just the facts", arHint: "الحقائق مباشرة" },
];

type Step = "audience" | "tone" | "result";

function arabicFallbackNarrative(
  profile: NonNullable<ReturnType<typeof locationById>>,
  audience: AudienceMode,
) {
  const walkthrough = visitorWalkthrough(profile.id, true) ?? profile.arabicStory;
  const blocks = walkthrough.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const observation = blocks[0] ?? profile.arabicSummary;
  const history = blocks[1] ?? profile.arabicHistoricalSummary;
  const living = blocks[2] ?? profile.arabicCulturalImportance;
  const guidance = blocks[3] ?? "";
  const landmarks = profile.arabicLandmarks.join("، ");

  if (audience === "tourist") return walkthrough;
  if (audience === "student") {
    return [
      `مدخل إلى المكان\n${profile.arabicSummary}`,
      `التسلسل التاريخي وعلاقة السبب بالنتيجة\n${history}`,
      `قراءة العمارة والمشهد\n${observation}`,
      `لماذا يهمّ المكان؟\n${profile.arabicCulturalImportance}`,
      `خلاصة التعلّم\nاربط بين التاريخ والعناصر التي تراها، وميّز دائماً بين الأثر المادي والرواية الدينية والذاكرة الشفوية. ومن المعالم التي يساعدك السجل على تتبعها: ${landmarks}.`,
    ].join("\n\n");
  }
  if (audience === "child") {
    return [
      `هيا نكتشف ${profile.arabicName}. ${profile.arabicSummary}`,
      `${observation}`,
      `${living}`,
      `هل تستطيع أن تلاحظ ${profile.arabicLandmarks.slice(0, 3).join("، و")}؟ انظر بهدوء، واستمع إلى المكان، وتذكّر أن الحارة بيتٌ لأناس يعيشون فيها كل يوم.`,
    ].join("\n\n");
  }
  if (audience === "historian") {
    return [
      `الإطار التاريخي\n${profile.arabicHistoricalSummary}`,
      history,
      `الأدلة المكانية والمعمارية\n${observation}`,
      `المجتمع والدلالة الثقافية\n${profile.arabicCulturalImportance}\n${living}`,
      `المعالم المرجعية\n${landmarks}.`,
      guidance,
      "حدود السجل\nتُفصل القراءة المعمارية والتاريخ المؤرخ عن الموروث الديني والشهادة الشفوية، ولا تُستكمل الفجوات بادعاءات غير موثقة.",
    ].filter(Boolean).join("\n\n");
  }
  if (audience === "short") {
    const sentences = `${profile.arabicSummary} ${profile.arabicHistoricalSummary} ${profile.arabicCulturalImportance}`
      .split(/(?<=[.!؟。])/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    return sentences.slice(0, 5).join(" ");
  }
  return `${profile.arabicStory}\n\n${walkthrough}`;
}

/**
 * Story generation as three steps rather than one button.
 *
 * Choosing the audience is the decision that changes the story most, so it gets
 * a screen of its own instead of being a dropdown someone skips past. The tone
 * step is skippable - it refines, it does not transform.
 */
export const StoryWizard: React.FC<StoryWizardProps> = ({ location, autoPlay }) => {
  const { isArabic, language } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const profile = locationById(location.id);
  const [step, setStep] = useState<Step>("audience");
  const [audience, setAudience] = useState<AudienceMode>("student");
  const [tone, setTone] = useState<StoryTone>("storytelling");
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (chosenTone: StoryTone) => {
    setGenerating(true);
    setError(null);
    setStep("result");
    try {
      const result = await generateStory(location.id, audience, chosenTone, language);
      let generated = result.data;
      // The network-free extractive engine stores its reviewed source in
      // English. In Arabic mode, use the reviewed Arabic profile whenever a
      // backend fallback comes back untranslated instead of leaking English.
      if (isArabic && profile && !/[\u0600-\u06ff]/.test(generated.narrative)) {
        const narrative = arabicFallbackNarrative(profile, audience);
        generated = {
          ...generated,
          title: profile.arabicStoryTitle,
          summary: profile.arabicSummary,
          narrative,
          timestamps: undefined,
          language: "ar",
          wordCount: narrative.split(/\s+/).filter(Boolean).length,
          uncertaintyNotes: ["صياغة عربية استخراجية من ملف المكان المراجع؛ لم تُضف حقائق من خارج السجل."],
          generatedBy: "arabic-reviewed-fallback",
        };
      }
      setStory(generated);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : (isArabic ? "تعذر توليد الحكاية الآن." : "The story could not be generated right now."),
      );
    } finally {
      setGenerating(false);
    }
  };

  const restart = () => {
    setStory(null);
    setError(null);
    setStep("audience");
  };

  const stepIndex = step === "audience" ? 0 : step === "tone" ? 1 : 2;

  return (
    <div className="bg-white rounded-3xl border border-brand-border p-6 space-y-5 shadow-sm">
      {/* --- Step indicator --------------------------------------------- */}
      <ol className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
        {(isArabic ? ["الجمهور", "الأسلوب", "الحكاية"] : ["Audience", "Style", "Story"]).map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full inline-flex items-center justify-center border transition-colors ${
                index < stepIndex
                  ? "bg-brand-olive text-brand-bg border-brand-olive"
                  : index === stepIndex
                    ? "border-brand-amber text-brand-amber"
                    : "border-brand-border text-brand-muted"
              }`}
            >
              {index < stepIndex ? <Check className="w-3 h-3" /> : index + 1}
            </span>
            <span className={index === stepIndex ? "text-brand-olive" : "text-brand-muted"}>
              {label}
            </span>
            {index < 2 && <span className="w-6 h-px bg-brand-border-light" />}
          </li>
        ))}
      </ol>

      {/*
        Keyed on `step` so React remounts and the entrance animation replays.
        Deliberately not wrapped in AnimatePresence: with `mode="wait"` the
        outgoing step never finished exiting here, so the new step never
        mounted and the wizard froze on screen even though its state had moved
        on. An entrance-only animation cannot get stuck.
      */}
      <motion.div
        key={step}
        initial={{ opacity: 0, x: reduced ? 0 : 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduced ? 0.12 : 0.25 }}
        className="space-y-4"
      >
          {step === "audience" && (
            <>
              <div>
                <h3 className="font-serif font-black text-xl text-brand-olive">
                  {isArabic ? "لمن نروي هذه الحكاية؟" : "Who is this story for?"}
                </h3>
                <p className="text-xs text-brand-muted">
                  {isArabic ? "المحتوى المراجع نفسه، بصياغة تناسب قارئاً مختلفاً." : "The same reviewed content, told for a different reader."}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AUDIENCES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setAudience(option.value);
                      setStep("tone");
                    }}
                    className={`text-start px-4 py-3 rounded-2xl border transition-colors group ${
                      audience === option.value
                        ? "border-brand-amber bg-brand-amber/5"
                        : "border-brand-border hover:border-brand-amber"
                    }`}
                  >
                    <span className="font-serif font-bold text-sm text-brand-olive block">
                      {isArabic ? option.ar : option.en}
                    </span>
                    <span className="text-xs text-brand-muted">{isArabic ? option.arHint : option.enHint}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "tone" && (
            <>
              <div>
                <h3 className="font-serif font-black text-xl text-brand-olive">
                  {isArabic ? "كيف تريد أن تبدو الحكاية؟" : "How should it sound?"}
                </h3>
                <p className="text-xs text-brand-muted">
                  {isArabic ? "اختياري — الأسلوب الافتراضي مناسب لمعظم القراء." : "Optional — the default reads well for most people."}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {TONES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setTone(option.value);
                      void run(option.value);
                    }}
                    className={`text-start px-4 py-3 rounded-2xl border transition-colors ${
                      tone === option.value
                        ? "border-brand-amber bg-brand-amber/5"
                        : "border-brand-border hover:border-brand-amber"
                    }`}
                  >
                    <span className="font-serif font-bold text-sm text-brand-olive block">
                      {isArabic ? option.ar : option.en}
                    </span>
                    <span className="text-[10px] text-brand-muted">{isArabic ? option.arHint : option.enHint}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setStep("audience")}
                  className="text-xs font-serif font-bold uppercase tracking-widest text-brand-muted hover:text-brand-olive inline-flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {isArabic ? "رجوع" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => void run(tone)}
                  className="bg-brand-amber hover:bg-[#b45f05] text-white text-xs font-serif font-black tracking-widest uppercase px-6 py-3 rounded-full inline-flex items-center gap-2 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isArabic ? "اكتب الحكاية" : "Write it"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}

          {step === "result" && (
            <>
              {generating && (
                <div className="py-10 text-center space-y-3">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-amber mx-auto" />
                  <p className="text-xs text-brand-muted font-serif italic">
                    {isArabic ? `نقرأ السجلات المراجعة عن ${profile?.arabicName ?? location.arabicName ?? location.name}…` : `Reading the reviewed records for ${location.name}…`}
                  </p>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              {story && !generating && (
                <article className="space-y-4">
                  <div>
                    <h3 className="font-serif font-black text-2xl text-brand-olive">
                      {story.title}
                    </h3>
                    <p className="text-xs text-brand-muted font-serif italic">
                      {story.summary}
                    </p>
                  </div>

                  <StoryNarrator
                    text={story.narrative}
                    summary={story.summary}
                    timestamps={story.timestamps}
                    typing
                    autoPlay={autoPlay}
                    locationId={location.id}
                  />

                  {story.warnings.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1.5">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-red-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" />
                        {isArabic ? "معلّمة للمراجعة" : "Flagged for review"}
                      </p>
                      <ul className="text-xs text-red-800 leading-relaxed list-disc pl-4 space-y-1">
                        {story.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <TransparencyPanel
                    sourceFile={story.source.contentFile ?? location.contentFile}
                    summaryFile={story.source.summaryFile ?? location.aiSummaryFile}
                    generatedBy={story.generatedBy}
                    wordCount={story.wordCount}
                    audience={story.targetAudience}
                    uncertaintyNotes={story.uncertaintyNotes}
                    queuedForReview={Boolean(story.storyId)}
                  />

                  <button
                    type="button"
                    onClick={restart}
                    className="text-xs font-serif font-bold uppercase tracking-widest text-brand-olive hover:text-brand-amber inline-flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {isArabic ? "اروِها بطريقة أخرى" : "Tell it differently"}
                  </button>
                </article>
              )}
            </>
          )}
      </motion.div>

      {step !== "result" && (
        <SourceCitationLine
          sourceId={location.contentFile}
          locationId={location.id}
          className="pt-1 border-t border-brand-border-light"
          compact
        />
      )}
    </div>
  );
};
