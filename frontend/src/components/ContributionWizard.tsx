import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Image as ImageIcon,
  Loader2,
  Mic,
  Send,
  ShieldCheck,
  Video,
} from "lucide-react";
import { ApiLocation, NewContribution } from "../types";
import { submitContribution } from "../services/api";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorates, locationById } from "../data/heritage";

interface ContributionWizardProps {
  locations: ApiLocation[];
  defaultLocationId?: string;
}

type Step = "place" | "memory" | "media" | "you" | "done";

const STEPS = [
  { id: "place" as const, en: "Place", ar: "المكان" },
  { id: "memory" as const, en: "Memory", ar: "الذكرى" },
  { id: "media" as const, en: "Media", ar: "الوسائط" },
  { id: "you" as const, en: "You", ar: "بياناتك" },
];

const MIN_CONTENT_LENGTH = 20;

const MEDIA_KINDS = [
  { value: "image" as const, en: "Photograph", ar: "صورة", icon: ImageIcon },
  { value: "audio" as const, en: "Recording", ar: "تسجيل صوتي", icon: Mic },
  { value: "video" as const, en: "Video", ar: "فيديو", icon: Video },
];

/**
 * The contribution form as a short sequence of steps.
 *
 * One long form asks for everything at once and gets abandoned. Splitting it
 * puts the memory itself on a screen of its own, which is the only part that
 * actually matters - place is a dropdown, media and name are optional, and the
 * whole thing can be finished in two steps if that is all someone wants to give.
 *
 * There is no mock fallback anywhere in here: if the submission fails the
 * contributor is told, and told to keep their text. A fake receipt for a memory
 * that was never saved would be the worst thing this page could do.
 */
export const ContributionWizard: React.FC<ContributionWizardProps> = ({
  locations,
  defaultLocationId,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const [step, setStep] = useState<Step>("place");
  const [form, setForm] = useState<NewContribution>({
    locationId: defaultLocationId ?? "",
    title: "",
    content: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ message: string; code?: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const update = <K extends keyof NewContribution>(
    key: K,
    value: NewContribution[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const contentTooShort = form.content.trim().length < MIN_CONTENT_LENGTH;
  const canContinue =
    step === "place"
      ? Boolean(form.locationId)
      : step === "memory"
        ? Boolean(form.title.trim()) && !contentTooShort
        : true;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await submitContribution({
        ...form,
        title: form.title.trim(),
        content: form.content.trim(),
        contributorName: form.contributorName?.trim() || undefined,
        contributorEmail: form.contributorEmail?.trim() || undefined,
        mediaUrl: form.mediaUrl?.trim() || undefined,
        mediaType: form.mediaUrl?.trim() ? form.mediaType : undefined,
      });
      setReceipt({ message: isArabic ? "وصلت مساهمتك إلى حكاية. يراجعها عضو من فريق التوثيق قبل نشرها، حفاظاً على الدقة وخصوصية أصحاب الذكريات." : response.message, code: response.referenceCode });
      setStep("done");
    } catch (caught) {
      setError(isArabic
        ? "تعذر إرسال المساهمة الآن. احتفظ بنصك وحاول مجدداً بعد التحقق من اتصال الخادم."
        : caught instanceof Error ? caught.message : "The contribution could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    "w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-amber transition-colors";
  const labelClass =
    "text-xs font-mono uppercase tracking-widest text-brand-muted block mb-1.5";

  if (step === "done" && receipt) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface rounded-3xl border border-brand-border p-6 space-y-4 shadow-sm text-center"
      >
        <span className="w-12 h-12 rounded-full bg-green-50 border border-green-200 inline-flex items-center justify-center">
          <Check className="w-6 h-6 text-green-700" />
        </span>
        <h3 className="font-serif font-black text-xl text-brand-olive">{isArabic ? "شكراً لك" : "Thank you"}</h3>
        <p className="text-sm text-brand-text leading-relaxed max-w-md mx-auto">
          {receipt.message}
        </p>

        {receipt.code && (
          <div className="bg-brand-bg border border-brand-border-light rounded-2xl p-4 space-y-2 inline-block">
            <p className="text-xs font-mono uppercase tracking-widest text-brand-muted">
              {isArabic ? "رمز المتابعة" : "Your reference"}
            </p>
            <div className="flex items-center gap-2 justify-center">
              <code className="font-mono font-bold text-lg text-brand-olive tracking-wider">
                {receipt.code}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(receipt.code as string);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
                aria-label={isArabic ? "نسخ رمز المتابعة" : "Copy reference code"}
                className="text-brand-muted hover:text-brand-olive p-1.5"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-brand-muted max-w-xs">
              {isArabic ? "احتفظ بهذا الرمز لتتابع مساهمتك لاحقاً؛ لا توجد حسابات، لذلك فهو طريقك الوحيد للعودة إليها." : "Keep this to check on your memory later — there are no accounts, so it is the only way back to it."}
            </p>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => {
              setForm({ locationId: form.locationId, title: "", content: "" });
              setReceipt(null);
              setStep("place");
            }}
            className="text-xs font-serif font-bold uppercase tracking-widest text-brand-olive hover:text-brand-amber"
          >
            {isArabic ? "شارك ذكرى أخرى" : "Share another memory"}
          </button>
        </div>
      </motion.div>
    );
  }

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  return (
    <div className="bg-brand-surface rounded-3xl border border-brand-border p-6 space-y-5 shadow-sm">
      <ol className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider flex-wrap">
        {STEPS.map((entry, index) => (
          <li key={entry.id} className="flex items-center gap-2">
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
              {isArabic ? entry.ar : entry.en}
            </span>
            {index < STEPS.length - 1 && <span className="w-4 h-px bg-brand-border-light" />}
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
          {step === "place" && (
            <>
              <h3 className="font-serif font-black text-xl text-brand-olive">
                {isArabic ? "عن أي مكان تتحدث هذه الذكرى؟" : "Which place is this about?"}
              </h3>
              <div>
                <label className={labelClass} htmlFor="wizard-location">
                  {isArabic ? "المكان" : "Location"}
                </label>
                <select
                  id="wizard-location"
                  className={fieldClass}
                  value={form.locationId}
                  onChange={(event) => update("locationId", event.target.value)}
                >
                  <option value="" disabled>
                    {isArabic ? "اختر مكاناً…" : "Choose a place…"}
                  </option>
                  {governorates.map((governorate) => {
                    const inGovernorate = locations.filter((location) => (location.governorateId ?? "jerusalem") === governorate.id);
                    if (!inGovernorate.length) return null;
                    return (
                      <optgroup key={governorate.id} label={isArabic ? governorate.arabicName : governorate.name}>
                        {inGovernorate.map((location) => (
                          <option key={location.id} value={location.id}>
                            {isArabic ? (locationById(location.id)?.arabicName ?? location.arabicName ?? location.name) : location.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
            </>
          )}

          {step === "memory" && (
            <>
              <div>
                <h3 className="font-serif font-black text-xl text-brand-olive">
                  {isArabic ? "ماذا تتذكر؟" : "What do you remember?"}
                </h3>
                <p className="text-xs text-brand-muted">
                  {isArabic ? "شخص أو رائحة أو موسم أو عادة؛ أي تفصيل قد يضيع إن لم يُروَ." : "A person, a smell, a season, a habit — anything that would otherwise be lost."}
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="wizard-title">
                  {isArabic ? "ضع عنواناً" : "Give it a title"}
                </label>
                <input
                  id="wizard-title"
                  className={fieldClass}
                  value={form.title}
                  onChange={(event) => update("title", event.target.value)}
                  maxLength={200}
                  placeholder={isArabic ? "صباح الجمعة عند باب العامود" : "Friday mornings at Damascus Gate"}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="wizard-content">
                  {isArabic ? "ذكراك" : "Your memory"}
                </label>
                <textarea
                  id="wizard-content"
                  className={`${fieldClass} min-h-[170px] resize-y`}
                  value={form.content}
                  onChange={(event) => update("content", event.target.value)}
                  maxLength={10000}
                />
                <p className="text-xs font-mono text-brand-muted mt-1.5">
                  {form.content.trim().length} {isArabic ? "حرفاً" : "characters"}
                  {contentTooShort && (isArabic ? ` · يلزم ${MIN_CONTENT_LENGTH} حرفاً على الأقل` : ` · at least ${MIN_CONTENT_LENGTH} needed`)}
                </p>
              </div>
            </>
          )}

          {step === "media" && (
            <>
              <div>
                <h3 className="font-serif font-black text-xl text-brand-olive">
                  {isArabic ? "هل لديك صورة أو تسجيل؟" : "Is there a picture or a recording?"}
                </h3>
                <p className="text-xs text-brand-muted">
                  {isArabic ? "اختياري. لا تخزن المنصة الملفات بعد؛ ألصق رابطاً لصورة أو تسجيل صوتي أو فيديو منشور على الإنترنت." : "Optional. Hikaya has no file storage yet, so paste a link to something already online — a photo, a voice recording, a video."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {MEDIA_KINDS.map((kind) => {
                  const Icon = kind.icon;
                  const active = form.mediaType === kind.value;
                  return (
                    <button
                      key={kind.value}
                      type="button"
                      onClick={() =>
                        update("mediaType", active ? undefined : kind.value)
                      }
                      className={`text-xs font-serif px-4 py-2 rounded-full border inline-flex items-center gap-1.5 transition-colors ${
                        active
                          ? "bg-brand-olive text-brand-bg border-brand-olive"
                          : "border-brand-border hover:border-brand-amber text-brand-text"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {isArabic ? kind.ar : kind.en}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className={labelClass} htmlFor="wizard-media">
                  {isArabic ? "الرابط" : "Link"}
                </label>
                <input
                  id="wizard-media"
                  type="url"
                  className={fieldClass}
                  value={form.mediaUrl ?? ""}
                  onChange={(event) => update("mediaUrl", event.target.value)}
                  placeholder="https://…"
                />
              </div>
            </>
          )}

          {step === "you" && (
            <>
              <div>
                <h3 className="font-serif font-black text-xl text-brand-olive">
                  {isArabic ? "لمن ننسب الذكرى؟" : "Who should we credit?"}
                </h3>
                <p className="text-xs text-brand-muted">
                  {isArabic ? "الحقلان اختياريان. اتركهما فارغين إن رغبت في عدم ذكر الاسم." : "Both optional. Leave them blank to stay anonymous."}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="wizard-name">
                    {isArabic ? "الاسم" : "Your name"}
                  </label>
                  <input
                    id="wizard-name"
                    className={fieldClass}
                    value={form.contributorName ?? ""}
                    onChange={(event) => update("contributorName", event.target.value)}
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="wizard-email">
                    {isArabic ? "البريد الإلكتروني" : "Email"}
                  </label>
                  <input
                    id="wizard-email"
                    type="email"
                    className={fieldClass}
                    value={form.contributorEmail ?? ""}
                    onChange={(event) => update("contributorEmail", event.target.value)}
                    placeholder={isArabic ? "فقط إن سمحت لفريق التوثيق بالتواصل معك" : "Only if the documentation team may contact you"}
                  />
                </div>
              </div>
              <p className="text-xs text-brand-muted flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-brand-olive shrink-0 mt-0.5" />
                {isArabic ? "يراجع عضو من فريق التوثيق كل مساهمة قبل ظهورها. تُنشر الذكريات الشخصية بوصفها تراثاً شفوياً وتبقى منفصلة عن التاريخ الموثق." : "A documentation-team member reviews every contribution before it appears. Personal memories are published as oral heritage, kept separate from documented history."}
              </p>
            </>
          )}
      </motion.div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
          <p className="font-bold">{isArabic ? "لم تُحفظ المساهمة." : "The contribution was not saved."}</p>
          <p>{error}</p>
          <p className="text-red-700">
            {isArabic ? "لم يُخزّن شيء؛ انسخ نصك قبل مغادرة الصفحة." : "Nothing was stored — please copy your text before leaving the page."}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-brand-border-light">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)}
          className="text-xs font-serif font-bold uppercase tracking-widest text-brand-muted hover:text-brand-olive disabled:opacity-0 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {isArabic ? "رجوع" : "Back"}
        </button>

        {step === "you" ? (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="bg-brand-olive hover:bg-brand-olive-deep disabled:opacity-60 text-brand-bg text-xs font-serif font-black tracking-widest uppercase px-6 py-3 rounded-full inline-flex items-center gap-2 transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-brand-amber" />
            )}
            {submitting ? (isArabic ? "جارٍ الإرسال…" : "Sending…") : (isArabic ? "إرسال" : "Submit")}
          </button>
        ) : (
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => setStep(STEPS[stepIndex + 1].id)}
            className="bg-brand-olive hover:bg-brand-olive-deep disabled:opacity-40 disabled:cursor-not-allowed text-brand-bg text-xs font-serif font-black tracking-widest uppercase px-6 py-3 rounded-full inline-flex items-center gap-2 transition-colors"
          >
            {isArabic ? "متابعة" : "Continue"}
            <ArrowRight className="w-3.5 h-3.5 text-brand-amber" />
          </button>
        )}
      </div>
    </div>
  );
};
