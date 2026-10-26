import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BookHeart,
  Check,
  Copy,
  EyeOff,
  Globe,
  Image as ImageIcon,
  Loader2,
  Lock,
  Mic,
  Send,
  ShieldCheck,
  UserRound,
  Video,
} from "lucide-react";
import { ApiLocation, NewContribution } from "../types";
import { submitContribution } from "../services/api";
import { MyStoryPayload, saveStory } from "../services/accountSync";
import { rememberContribution } from "../services/myContributions";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { governorates, locationById } from "../data/heritage";

export interface ContributionDraft {
  locationId?: string;
  title: string;
  content: string;
}

interface ContributionWizardProps {
  locations: ApiLocation[];
  defaultLocationId?: string;
  /** Text prepared elsewhere (the interview kit); a new object re-applies it. */
  draft?: ContributionDraft | null;
}

type Step = "place" | "memory" | "media" | "share" | "done";
type Visibility = "private" | "public";
/** What goes out with a public story: the contributor's details, or nothing. */
type Credit = "named" | "anonymous";

const STEPS = [
  { id: "place" as const, en: "Place", ar: "المكان" },
  { id: "memory" as const, en: "Story", ar: "الحكاية" },
  { id: "media" as const, en: "Media", ar: "الوسائط" },
  { id: "share" as const, en: "Share", ar: "المشاركة" },
];

const MIN_CONTENT_LENGTH = 20;

const MEDIA_KINDS = [
  { value: "image" as const, en: "Photograph", ar: "صورة", icon: ImageIcon },
  { value: "audio" as const, en: "Recording", ar: "تسجيل صوتي", icon: Mic },
  { value: "video" as const, en: "Video", ar: "فيديو", icon: Video },
];

interface Receipt {
  visibility: Visibility;
  message: string;
  code?: string;
  creditedAs?: string | null;
}

/**
 * Writing your story of a place, as a short sequence of steps.
 *
 * One long form asks for everything at once and gets abandoned. Splitting it
 * puts the story itself on a screen of its own, which is the only part that
 * actually matters - place is a dropdown, media is optional, and the last step
 * asks who should see it: kept private in the passport, or sent to the review
 * team to be published for everyone, with or without the writer's name.
 *
 * There is no mock fallback anywhere in here: if a public submission fails the
 * writer is told, and told to keep their text. A fake receipt for a story that
 * was never saved would be the worst thing this page could do.
 */
export const ContributionWizard: React.FC<ContributionWizardProps> = ({
  locations,
  defaultLocationId,
  draft,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const [step, setStep] = useState<Step>("place");
  const [form, setForm] = useState<NewContribution>({
    locationId: defaultLocationId ?? "",
    title: "",
    content: "",
  });
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [copied, setCopied] = useState(false);

  // A draft from the interview kit replaces the story text and opens the
  // story step, where the writer reviews it before choosing who sees it.
  useEffect(() => {
    if (!draft) return;
    setForm((current) => ({
      ...current,
      locationId: draft.locationId || current.locationId,
      title: draft.title,
      content: draft.content,
    }));
    setReceipt(null);
    setStep("memory");
  }, [draft]);

  const update = <K extends keyof NewContribution>(
    key: K,
    value: NewContribution[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const chooseCredit = (value: Credit) => {
    setCredit(value);
    // A signed-in writer has already told us their name.
    if (value === "named" && !form.contributorName && user) update("contributorName", user.fullName);
  };

  const contentTooShort = form.content.trim().length < MIN_CONTENT_LENGTH;
  const canContinue =
    step === "place"
      ? Boolean(form.locationId)
      : step === "memory"
        ? Boolean(form.title.trim()) && !contentTooShort
        : true;
  const canSubmit =
    visibility === "private" ||
    (visibility === "public" &&
      (credit === "anonymous" || (credit === "named" && Boolean(form.contributorName?.trim()))));

  const submit = async () => {
    if (!canSubmit) return;
    const title = form.title.trim();
    const mediaUrl = form.mediaUrl?.trim() || undefined;
    const story: MyStoryPayload = {
      content: form.content.trim(),
      mediaUrl,
      mediaType: mediaUrl ? form.mediaType : undefined,
    };
    const keep = (payload: MyStoryPayload) =>
      saveStory({
        kind: "my_story",
        title,
        locationId: form.locationId,
        governorateIds: [locations.find((item) => item.id === form.locationId)?.governorateId ?? "jerusalem"],
        payload,
      });

    if (visibility === "private") {
      keep(story);
      setReceipt({
        visibility,
        message: isArabic
          ? "حُفظت حكايتك في جواز سفرك. لا يراها أحد غيرك، ويمكنك مشاركتها للعموم لاحقاً متى شئت."
          : "Your story is saved in your passport. Nobody else can see it, and you can share it publicly whenever you like.",
      });
      setStep("done");
      return;
    }

    setSubmitting(true);
    setError(null);
    const named = credit === "named";
    const creditedAs = named ? form.contributorName?.trim() || null : null;
    try {
      const response = await submitContribution({
        locationId: form.locationId,
        title,
        content: story.content,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        // "Only the story" sends nothing about the writer at all.
        contributorName: creditedAs ?? undefined,
        contributorEmail: named ? form.contributorEmail?.trim() || undefined : undefined,
      });
      if (response.referenceCode) {
        rememberContribution({
          referenceCode: response.referenceCode,
          title,
          locationId: form.locationId,
          submittedAt: new Date().toISOString(),
        });
      }
      keep({
        ...story,
        share: {
          referenceCode: response.referenceCode,
          contributionId: response.contribution.id,
          creditedAs,
          sharedAt: new Date().toISOString(),
        },
      });
      setReceipt({
        visibility,
        message: isArabic
          ? "وصلت حكايتك إلى فريق المراجعة في حكاية. بعد موافقة المشرف تظهر في صفحة المكان لكل الزوار."
          : "Your story reached the Hikaya review team. Once an admin approves it, it appears on the place page for every visitor.",
        code: response.referenceCode,
        creditedAs,
      });
      setStep("done");
    } catch (caught) {
      setError(isArabic
        ? "تعذر إرسال الحكاية الآن. احتفظ بنصك وحاول مجدداً بعد التحقق من اتصال الخادم."
        : caught instanceof Error ? caught.message : "The story could not be sent.");
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    setForm({ locationId: form.locationId, title: "", content: "" });
    setVisibility(null);
    setCredit(null);
    setReceipt(null);
    setStep("place");
  };

  const fieldClass =
    "w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-amber transition-colors";
  const labelClass =
    "text-xs font-mono uppercase tracking-widest text-brand-muted block mb-1.5";
  const choiceClass = (active: boolean) =>
    `w-full text-start rounded-2xl border p-4 flex gap-3 transition-colors ${
      active
        ? "border-brand-amber bg-brand-amber/10 ring-2 ring-brand-amber"
        : "border-brand-border hover:border-brand-amber"
    }`;

  if (step === "done" && receipt) {
    const shared = receipt.visibility === "public";
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-brand-surface rounded-3xl border border-brand-border p-6 space-y-4 shadow-sm text-center"
      >
        <span className="w-12 h-12 rounded-full bg-green-50 border border-green-200 inline-flex items-center justify-center">
          {shared ? <Check className="w-6 h-6 text-green-700" /> : <Lock className="w-6 h-6 text-green-700" />}
        </span>
        <h3 className="font-serif font-black text-xl text-brand-olive">
          {shared ? (isArabic ? "أُرسلت للمراجعة" : "Sent for review") : (isArabic ? "محفوظة لك وحدك" : "Saved just for you")}
        </h3>
        <p className="text-sm text-brand-text leading-relaxed max-w-md mx-auto">
          {receipt.message}
        </p>

        {shared && (
          <p className="text-xs text-brand-muted flex items-center justify-center gap-1.5">
            {receipt.creditedAs ? <UserRound className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {receipt.creditedAs
              ? (isArabic ? `ستظهر باسم: ${receipt.creditedAs}` : `It will appear as: ${receipt.creditedAs}`)
              : (isArabic ? "ستظهر دون اسم؛ شاركت الحكاية فقط." : "It will appear without a name — you shared only the story.")}
          </p>
        )}

        {shared && receipt.code && (
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
              {isArabic ? "تتابع حالتها في جواز سفرك، أو بهذا الرمز من أي جهاز." : "Follow its review in your passport, or with this code from any device."}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/me"
            className="bg-brand-olive hover:bg-brand-olive-deep text-brand-bg text-xs font-serif font-black tracking-widest uppercase px-5 py-2.5 rounded-full inline-flex items-center gap-2 transition-colors"
          >
            <BookHeart className="w-3.5 h-3.5 text-brand-amber" />
            {isArabic ? "افتح جواز سفري" : "Open my passport"}
          </Link>
          <button
            type="button"
            onClick={startOver}
            className="text-xs font-serif font-bold uppercase tracking-widest text-brand-olive hover:text-brand-amber"
          >
            {isArabic ? "اكتب حكاية أخرى" : "Write another story"}
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
                {isArabic ? "عن أي مكان تتحدث حكايتك؟" : "Which place is your story about?"}
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
                  {isArabic ? "ما حكايتك مع هذا المكان؟" : "What is your story of this place?"}
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
                  {isArabic ? "حكايتك" : "Your story"}
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

          {step === "share" && (
            <>
              <h3 className="font-serif font-black text-xl text-brand-olive">
                {isArabic ? "هل تريد أن تكون حكايتك عامة؟" : "Do you want to make your story public?"}
              </h3>
              <div role="radiogroup" aria-label={isArabic ? "من يرى الحكاية" : "Who can see the story"} className="grid gap-3 sm:grid-cols-2">
                <button type="button" role="radio" aria-checked={visibility === "private"} onClick={() => setVisibility("private")} className={choiceClass(visibility === "private")}>
                  <Lock className="w-5 h-5 shrink-0 text-brand-amber mt-0.5" />
                  <span>
                    <span className="block text-sm font-bold text-brand-olive">{isArabic ? "لا، أبقها لي" : "No, keep it private"}</span>
                    <span className="block text-xs text-brand-muted leading-relaxed mt-1">
                      {isArabic ? "تُحفظ في جواز سفرك ولا يراها أحد غيرك. يمكنك مشاركتها لاحقاً." : "Saved in your passport and seen by nobody else. You can share it later."}
                    </span>
                  </span>
                </button>
                <button type="button" role="radio" aria-checked={visibility === "public"} onClick={() => setVisibility("public")} className={choiceClass(visibility === "public")}>
                  <Globe className="w-5 h-5 shrink-0 text-brand-amber mt-0.5" />
                  <span>
                    <span className="block text-sm font-bold text-brand-olive">{isArabic ? "نعم، شاركها مع الجميع" : "Yes, share it with everyone"}</span>
                    <span className="block text-xs text-brand-muted leading-relaxed mt-1">
                      {isArabic ? "تُرسل إلى فريق المراجعة، وبعد موافقة المشرف تظهر في صفحة المكان لكل الزوار." : "Sent to the review team. Once an admin approves it, it appears on the place page for every visitor."}
                    </span>
                  </span>
                </button>
              </div>

              {visibility === "public" && (
                <div className="space-y-3 border-t border-brand-border-light pt-4">
                  <p className="text-sm font-bold text-brand-olive">
                    {isArabic ? "ماذا نشارك معها؟" : "What should we share with it?"}
                  </p>
                  <div role="radiogroup" aria-label={isArabic ? "ما يُنشر مع الحكاية" : "What is published with the story"} className="grid gap-3 sm:grid-cols-2">
                    <button type="button" role="radio" aria-checked={credit === "named"} onClick={() => chooseCredit("named")} className={choiceClass(credit === "named")}>
                      <UserRound className="w-5 h-5 shrink-0 text-brand-amber mt-0.5" />
                      <span>
                        <span className="block text-sm font-bold text-brand-olive">{isArabic ? "الحكاية واسمي" : "The story and my name"}</span>
                        <span className="block text-xs text-brand-muted leading-relaxed mt-1">
                          {isArabic ? "يظهر اسمك مع الحكاية." : "Your name appears with the story."}
                        </span>
                      </span>
                    </button>
                    <button type="button" role="radio" aria-checked={credit === "anonymous"} onClick={() => chooseCredit("anonymous")} className={choiceClass(credit === "anonymous")}>
                      <EyeOff className="w-5 h-5 shrink-0 text-brand-amber mt-0.5" />
                      <span>
                        <span className="block text-sm font-bold text-brand-olive">{isArabic ? "الحكاية فقط" : "Only the story"}</span>
                        <span className="block text-xs text-brand-muted leading-relaxed mt-1">
                          {isArabic ? "تُنشر دون اسم، ولا نرسل أي معلومات عنك." : "Published without a name. Nothing about you is sent."}
                        </span>
                      </span>
                    </button>
                  </div>

                  {credit === "named" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass} htmlFor="wizard-name">
                          {isArabic ? "الاسم الظاهر" : "Name to show"}
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
                          {isArabic ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}
                        </label>
                        <input
                          id="wizard-email"
                          type="email"
                          className={fieldClass}
                          value={form.contributorEmail ?? ""}
                          onChange={(event) => update("contributorEmail", event.target.value)}
                          placeholder={isArabic ? "لا يُنشر؛ للتواصل معك فقط" : "Never published; only so the team can reach you"}
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-brand-muted flex items-start gap-2 leading-relaxed">
                    <ShieldCheck className="w-4 h-4 text-brand-olive shrink-0 mt-0.5" />
                    {isArabic ? "لا يظهر شيء للعموم قبل موافقة المشرف. تُنشر الحكايات الشخصية بوصفها تراثاً شفوياً وتبقى منفصلة عن التاريخ الموثق." : "Nothing is public until an admin approves it. Personal stories are published as oral heritage, kept separate from documented history."}
                  </p>
                </div>
              )}
            </>
          )}
      </motion.div>

      {error && (
        <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
          <p className="font-bold">{isArabic ? "لم تُرسل الحكاية." : "The story was not sent."}</p>
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

        {step === "share" ? (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !canSubmit}
            className="bg-brand-olive hover:bg-brand-olive-deep disabled:opacity-40 disabled:cursor-not-allowed text-brand-bg text-xs font-serif font-black tracking-widest uppercase px-6 py-3 rounded-full inline-flex items-center gap-2 transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : visibility === "private" ? (
              <Lock className="w-3.5 h-3.5 text-brand-amber" />
            ) : (
              <Send className="w-3.5 h-3.5 text-brand-amber" />
            )}
            {submitting
              ? (isArabic ? "جارٍ الإرسال…" : "Sending…")
              : visibility === "private"
                ? (isArabic ? "احفظها لي" : "Save privately")
                : (isArabic ? "أرسلها للمراجعة" : "Send for review")}
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
