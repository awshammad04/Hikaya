import React, { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Check, BookHeart, Loader2 } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorates, governorateById } from "../data/heritage";
import {
  JourneyPreferences,
  TourInterest,
  AudienceMode,
  StoryTone,
  TourDuration,
} from "../types";
import { createJourney, JOURNEY_KEY } from "../services/journeys";
import { PageTransition } from "../components/motion";
import { MyJerusalemStoryModal } from "../components/MyJerusalemStoryModal";
import { HomePage } from "./HomePage";
import { saveStory } from "../services/accountSync";

const interests: { id: TourInterest; ar: string; en: string }[] = [
  { id: "history", ar: "تاريخ وحضارات", en: "History & civilizations" },
  {
    id: "architecture",
    ar: "عمارة وتراث مبني",
    en: "Architecture & built heritage",
  },
  { id: "religious", ar: "مقدسات وأماكن عبادة", en: "Sacred sites & worship" },
  { id: "food_markets", ar: "أسواق ومأكولات", en: "Souqs & food" },
  {
    id: "oral_heritage",
    ar: "حكايات الناس والذاكرة الشفوية",
    en: "People’s stories & oral memory",
  },
];
const durations: { id: TourDuration; ar: string; en: string }[] = [
  {
    id: "express",
    ar: "سريعة · حتى 3 محطات",
    en: "Express · up to 3 chapters",
  },
  {
    id: "half_day",
    ar: "نصف يوم · حتى 5 محطات",
    en: "Half day · up to 5 chapters",
  },
  {
    id: "full_day",
    ar: "يوم كامل · حتى 7 محطات",
    en: "Full day · up to 7 chapters",
  },
  {
    id: "weekend",
    ar: "نهاية أسبوع معمّقة · حتى 14 محطة",
    en: "In-depth weekend · up to 14 chapters",
  },
];
/** Mirrors the backend's stop budget for each journey length. */
const DURATION_STOPS: Record<TourDuration, number> = {
  express: 3,
  half_day: 5,
  full_day: 7,
  weekend: 14,
};
const Choice: React.FC<
  React.PropsWithChildren<{ selected: boolean; onClick: () => void }>
> = ({ selected, onClick, children }) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={`min-h-14 p-4 rounded-2xl border text-start text-sm font-bold transition-colors inline-flex justify-between items-center gap-3 ${selected ? "bg-brand-olive text-white border-brand-olive" : "bg-brand-surface border-brand-border hover:border-brand-amber"}`}
  >
    {children}
    <span
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-brand-amber-light bg-brand-amber-light text-[#3f412d]" : "border-brand-border"}`}
      aria-hidden="true"
    >
      {selected && <Check className="w-3.5 h-3.5" />}
    </span>
  </button>
);

export const CreateStoryPage: React.FC = () => {
  const { governorateId } = useParams();
  const { isArabic, language } = useInterfaceLanguage();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<JourneyPreferences>({
    governorateIds: governorateId
      ? [governorateId]
      : governorates.map((item) => item.id),
    language,
    duration: "half_day",
    interests: ["history", "architecture"],
    targetAudience: "general",
    tone: "storytelling",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (governorateId === "jerusalem")
    return (
      <>
        <HomePage />
        <MyJerusalemStoryModal
          open={true}
          onClose={() => navigate("/governorates/jerusalem")}
        />
      </>
    );
  if (governorateId && !governorateById(governorateId))
    return <Navigate to="/" replace />;
  const name = governorateId
    ? isArabic
      ? governorateById(governorateId)!.arabicName
      : governorateById(governorateId)!.name
    : isArabic
      ? "فلسطين"
      : "Palestine";
  const title = isArabic
    ? `أنشئ حكايتك في ${name}`
    : `Create your ${name} story`;
  const stepLabels = [
    { ar: "المحافظات", en: "Places" },
    { ar: "الأسلوب", en: "Style" },
    { ar: "الوقت", en: "Time" },
    { ar: "الاهتمامات", en: "Interests" },
  ].slice(governorateId ? 1 : 0);
  const totalSteps = stepLabels.length;
  const currentStep = governorateId ? step + 1 : step;
  const allSelected = preferences.governorateIds.length === governorates.length;
  const toggleGov = (id: string) =>
    setPreferences((current) => ({
      ...current,
      governorateIds: current.governorateIds.includes(id)
        ? current.governorateIds.filter((item) => item !== id)
        : [...current.governorateIds, id],
    }));
  const toggleInterest = (id: TourInterest) =>
    setPreferences((current) => ({
      ...current,
      interests: current.interests.includes(id)
        ? current.interests.filter((item) => item !== id)
        : [...current.interests, id],
    }));
  const build = async () => {
    setBusy(true);
    setError("");
    try {
      const journey = await createJourney(preferences);
      try {
        localStorage.setItem(JOURNEY_KEY, JSON.stringify(journey));
      } catch {
        throw new Error(
          isArabic
            ? "تعذّر حفظ الرحلة على هذا الجهاز. تأكد من توفر مساحة التخزين."
            : "Could not save the journey on this device. Check browser storage space.",
        );
      }
      // Every journey is also kept in the passport (and the account, if any).
      saveStory({
        kind: "journey",
        title: journey.title,
        governorateIds: journey.governorateIds,
        payload: journey,
        createdAt: journey.createdAt,
      });
      navigate("/my-story");
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto">
        <section className="rounded-3xl border border-brand-border bg-brand-surface shadow-lg overflow-hidden">
          <header className="relative bg-brand-olive text-white p-7 sm:p-10">
            <div className="absolute inset-0 tatreez-grid opacity-10 pointer-events-none" />
            <div className="relative">
              <h1 className="font-serif font-black text-3xl sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/80">
                {isArabic
                  ? "حكاية شخصية من أماكن المحافظات التي تختارها، وفق اهتماماتك ولغتك ووقت القراءة."
                  : "A personal story from your selected governorates, shaped by your interests, language and reading time."}
              </p>
            </div>
          </header>
          <div className="p-6 sm:p-10 space-y-7">
            <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }} aria-label={isArabic ? "خطوات الحكاية" : "Story steps"}>
              {stepLabels.map((label, index) => (
                <li key={label.en} className="space-y-2" aria-current={index === step ? "step" : undefined}>
                  <span className={`block h-1.5 rounded-full ${index <= step ? "bg-brand-amber" : "bg-brand-border-light"}`} />
                  <span className={`block text-xs font-bold ${index === step ? "text-brand-olive" : "text-brand-muted"}`}>
                    {index + 1}. {isArabic ? label.ar : label.en}
                  </span>
                </li>
              ))}
            </ol>
            {currentStep === 0 && (
              <div className="space-y-4">
                <h2 className="font-serif text-xl font-black text-brand-olive">
                  {isArabic
                    ? "اختر محافظة أو أكثر"
                    : "Choose one or more governorates"}
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    setPreferences({
                      ...preferences,
                      governorateIds: allSelected ? [] : governorates.map((item) => item.id),
                    })
                  }
                  className="text-sm font-bold text-brand-amber underline underline-offset-4"
                >
                  {allSelected
                    ? isArabic ? "إلغاء تحديد الكل" : "Clear selection"
                    : isArabic ? "اختر كل المحافظات" : "Select all governorates"}
                </button>
                <div className="grid sm:grid-cols-2 gap-3">
                  {governorates.map((item) => (
                    <Choice
                      key={item.id}
                      selected={preferences.governorateIds.includes(item.id)}
                      onClick={() => toggleGov(item.id)}
                    >
                      {isArabic ? item.arabicName : item.name}
                    </Choice>
                  ))}
                </div>
              </div>
            )}
            {currentStep === 1 && (
              <div className="space-y-5">
                <h2 className="font-serif text-xl font-black text-brand-olive">
                  {isArabic ? "اللغة وأسلوب الحكاية" : "Language & story style"}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {(["ar", "en"] as const).map((id) => (
                    <Choice
                      key={id}
                      selected={preferences.language === id}
                      onClick={() =>
                        setPreferences({ ...preferences, language: id })
                      }
                    >
                      {id === "ar" ? "العربية" : "English"}
                    </Choice>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm font-bold text-brand-olive">
                    {isArabic ? "لمن تُروى الحكاية؟" : "Who is the story for?"}
                    <select
                      className="block mt-2 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm font-normal text-brand-text"
                      value={preferences.targetAudience}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          targetAudience: event.target.value as AudienceMode,
                        })
                      }
                    >
                      {[
                        { id: "general", ar: "الجميع", en: "General" },
                        { id: "student", ar: "طالب", en: "Student" },
                        { id: "tourist", ar: "زائر", en: "Visitor" },
                        { id: "child", ar: "طفل", en: "Child" },
                        { id: "short", ar: "حكاية قصيرة", en: "Short story" },
                        {
                          id: "historian",
                          ar: "باحث في التاريخ",
                          en: "Historian",
                        },
                      ].map((item) => (
                        <option key={item.id} value={item.id}>
                          {isArabic ? item.ar : item.en}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-bold text-brand-olive">
                    {isArabic ? "النبرة" : "Tone"}
                    <select
                      className="block mt-2 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm font-normal text-brand-text"
                      value={preferences.tone}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          tone: event.target.value as StoryTone,
                        })
                      }
                    >
                      {[
                        { id: "storytelling", ar: "سردية", en: "Storytelling" },
                        { id: "educational", ar: "تعليمية", en: "Educational" },
                        { id: "neutral", ar: "محايدة", en: "Neutral" },
                        { id: "emotional", ar: "وجدانية", en: "Reflective" },
                      ].map((item) => (
                        <option key={item.id} value={item.id}>
                          {isArabic ? item.ar : item.en}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="font-serif text-xl font-black text-brand-olive">
                  {isArabic
                    ? "كم من الوقت ترغب في الاستكشاف؟"
                    : "How deeply would you like to explore?"}
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {durations.map((item) => (
                    <Choice
                      key={item.id}
                      selected={preferences.duration === item.id}
                      onClick={() =>
                        setPreferences({ ...preferences, duration: item.id })
                      }
                    >
                      {isArabic ? item.ar : item.en}
                    </Choice>
                  ))}
                </div>
                {/* The journey keeps one chapter per chosen governorate even when
                    that is more than the length's usual number of stops. */}
                {preferences.governorateIds.length > (DURATION_STOPS[preferences.duration] ?? 5) && (
                  <p className="rounded-2xl border border-brand-amber/30 bg-brand-amber/10 px-4 py-3 text-sm text-brand-text" role="note">
                    {isArabic
                      ? `اخترت ${preferences.governorateIds.length} محافظات، فستضم الحكاية ${preferences.governorateIds.length} فصول: فصلاً واحداً على الأقل لكل محافظة.`
                      : `You chose ${preferences.governorateIds.length} governorates, so the story will have ${preferences.governorateIds.length} chapters: at least one for each.`}
                  </p>
                )}
              </div>
            )}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h2 className="font-serif text-xl font-black text-brand-olive">
                  {isArabic
                    ? "ما الذي يهمك؟ اختر أكثر من خيار"
                    : "What interests you? Choose more than one"}
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {interests.map((item) => (
                    <Choice
                      key={item.id}
                      selected={preferences.interests.includes(item.id)}
                      onClick={() => toggleInterest(item.id)}
                    >
                      {isArabic ? item.ar : item.en}
                    </Choice>
                  ))}
                </div>
              </div>
            )}
            {step === totalSteps - 1 && (
            <p className="rounded-2xl bg-brand-bg p-4 text-sm leading-6 text-brand-muted">
              {isArabic
                ? "هذه رحلة ثقافية للقراءة والاستماع، وليست مسار سفر مؤكداً. تضم محطة من كل محافظة مختارة متى توفر محتوى، وتوضّح الفجوات في المصادر."
                : "This is a cultural reading and listening journey. It includes a chapter from each selected governorate where content is available, and makes source gaps visible. It does not establish a travel route."}
            </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex justify-between gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep(step - 1)}
                  className="rounded-full border border-brand-border px-5 py-3 text-sm font-bold text-brand-olive"
                >
                  {isArabic ? "رجوع" : "Back"}
                </button>
              ) : (
                <span />
              )}
              {step < totalSteps - 1 ? (
                <button
                  disabled={!preferences.governorateIds.length}
                  onClick={() => setStep(step + 1)}
                  className="rounded-full bg-brand-olive px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-olive-deep disabled:opacity-50"
                >
                  {isArabic ? "التالي" : "Next"}
                </button>
              ) : (
                <button
                  disabled={
                    busy ||
                    !preferences.interests.length ||
                    !preferences.governorateIds.length
                  }
                  onClick={() => void build()}
                  className="rounded-full bg-brand-amber px-6 py-3 text-sm font-bold text-white inline-flex gap-2 items-center transition-colors hover:bg-brand-amber-deep disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BookHeart className="w-4 h-4" />
                  )}
                  {busy
                    ? isArabic
                      ? "جارٍ إنشاء الحكاية"
                      : "Creating your story"
                    : isArabic
                      ? "أنشئ حكايتي"
                      : "Create my story"}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </PageTransition>
  );
};
