import React, { useEffect, useMemo, useState } from "react";
import { HeartHandshake, Mic, Printer, Sparkles } from "lucide-react";
import type { ApiLocation } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById } from "../data/heritage";
import type { ContributionDraft } from "./ContributionWizard";

interface Prompt {
  id: string;
  ar: string;
  en: string;
}

const COMMON: Prompt[] = [
  { id: "first", ar: "ما أول ما يخطر لك حين تسمع اسم هذا المكان؟", en: "What is the first thing you think of when you hear this place's name?" },
  { id: "when", ar: "متى كنت تذهب إليه، ومع من؟", en: "When did you go there, and with whom?" },
  { id: "senses", ar: "ماذا كنت تسمع وتشمّ وترى هناك؟", en: "What did you hear, smell and see there?" },
  { id: "people", ar: "من الناس الذين تتذكرهم هناك؟ بائع، جار، معلّم؟", en: "Which people do you remember there: a seller, a neighbour, a teacher?" },
  { id: "change", ar: "ما الذي تغيّر منذ ذلك الوقت؟", en: "What has changed since then?" },
  { id: "keep", ar: "ما الذي تتمنى أن يعرفه أحفادك عن هذا المكان؟", en: "What do you wish your grandchildren knew about this place?" },
];

/** Extra questions that fit the kind of place being remembered. */
const BY_CATEGORY: Record<string, Prompt[]> = {
  "سوق تراثي": [
    { id: "shop", ar: "أي دكان كنت تقصده؟ ماذا كان يبيع، وبكم؟", en: "Which shop did you go to? What did it sell, and for how much?" },
    { id: "call", ar: "هل تتذكر نداءات الباعة أو عبارة كانوا يرددونها؟", en: "Do you remember sellers' calls or a phrase they used to repeat?" },
  ],
  "معلم ديني": [
    { id: "feast", ar: "كيف كانت الأعياد والمناسبات هناك؟", en: "What were feasts and occasions like there?" },
    { id: "gather", ar: "من كان يجتمع هناك، وماذا كانوا يفعلون بعد الصلاة أو القداس؟", en: "Who gathered there, and what did people do after prayers or mass?" },
  ],
  "حارة تاريخية": [
    { id: "house", ar: "صف لي بيتاً أو زقاقاً تعرفه هناك.", en: "Describe a house or an alley you knew there." },
    { id: "games", ar: "بماذا كان الأطفال يلعبون في الحارة؟", en: "What did children play in the quarter?" },
  ],
  "حي مقدسي": [
    { id: "neighbours", ar: "كيف كانت العلاقة بين الجيران؟", en: "What were neighbours like with one another?" },
    { id: "seasons", ar: "ماذا كان يُزرع أو يُقطف هناك في المواسم؟", en: "What was planted or harvested there through the seasons?" },
  ],
  متحف: [
    { id: "visit", ar: "ماذا شعرت حين زرته أول مرة؟ وأي قطعة بقيت في ذاكرتك؟", en: "How did you feel on your first visit? Which object stayed with you?" },
  ],
};

const STORAGE_KEY = "hikaya.interview-draft";

interface Notes {
  locationId: string;
  who: string;
  when: string;
  answers: Record<string, string>;
}

function loadNotes(defaultLocationId: string): Notes {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Notes | null;
    if (saved && typeof saved === "object" && saved.answers) {
      return { ...saved, locationId: defaultLocationId || saved.locationId };
    }
  } catch {
    // A damaged draft is simply not restored.
  }
  return { locationId: defaultLocationId, who: "", when: "", answers: {} };
}

interface InterviewKitProps {
  locations: ApiLocation[];
  defaultLocationId?: string;
  onUseNotes: (draft: ContributionDraft) => void;
}

/**
 * A guided interview for recording an elder's memories of a place.
 *
 * Oral memory is the part of heritage that disappears first, and the people
 * who hold it rarely write. This gives a grandchild, a student or a volunteer
 * the questions to ask, place by place, keeps their notes on the device while
 * they talk, and turns the answers into a memory for the review queue, credited
 * to the person who remembered it.
 */
export const InterviewKit: React.FC<InterviewKitProps> = ({ locations, defaultLocationId = "", onUseNotes }) => {
  const { isArabic } = useInterfaceLanguage();
  const [notes, setNotes] = useState<Notes>(() => loadNotes(defaultLocationId));

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch {
      // Notes still live in the page; they just will not survive a reload.
    }
  }, [notes]);

  const location = locations.find((item) => item.id === notes.locationId);
  const placeName = location
    ? isArabic ? (locationById(location.id)?.arabicName ?? location.arabicName ?? location.name) : location.name
    : "";
  const prompts = useMemo(() => {
    const extra = (location?.categories ?? []).flatMap((category) => BY_CATEGORY[category] ?? []);
    const seen = new Set<string>();
    return [...COMMON.slice(0, 3), ...extra, ...COMMON.slice(3)].filter((prompt) => !seen.has(prompt.id) && seen.add(prompt.id));
  }, [location]);

  const answered = prompts.filter((prompt) => notes.answers[prompt.id]?.trim());
  const setAnswer = (id: string, value: string) =>
    setNotes((current) => ({ ...current, answers: { ...current.answers, [id]: value } }));

  const useNotes = () => {
    const who = notes.who.trim() || (isArabic ? "أحد كبار العائلة" : "a family elder");
    const header = isArabic
      ? `من مقابلة مع ${who}${notes.when.trim() ? `، عن ${notes.when.trim()}` : ""}.`
      : `From an interview with ${who}${notes.when.trim() ? `, about ${notes.when.trim()}` : ""}.`;
    const body = answered
      .map((prompt) => `${isArabic ? prompt.ar : prompt.en}\n${notes.answers[prompt.id].trim()}`)
      .join("\n\n");
    onUseNotes({
      locationId: notes.locationId,
      title: (isArabic ? `ذكريات ${who} عن ${placeName}` : `${who}'s memories of ${placeName}`).slice(0, 200),
      content: `${header}\n\n${body}`.slice(0, 10000),
    });
  };

  const field =
    "w-full rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text focus:border-brand-amber focus:outline-none";

  return (
    <section className="space-y-6 rounded-3xl border border-brand-border bg-brand-surface p-6 sm:p-8 print:border-0 print:p-0" aria-labelledby="interview-kit-title">
      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-brand-amber">
          <HeartHandshake className="h-4 w-4" />
          {isArabic ? "دليل المقابلة" : "Interview guide"}
        </p>
        <h2 id="interview-kit-title" className="font-serif text-2xl font-black text-brand-olive">
          {isArabic ? "اجمع ذكرى من أحد كبار العائلة" : "Record a memory from a family elder"}
        </h2>
        <p className="text-sm leading-relaxed text-brand-muted">
          {isArabic
            ? "اجلس مع جدّ أو جارة أو معلّم قديم، واطرح الأسئلة بهدوء. لا تحتاج إلى الإجابة عن كل سؤال؛ اكتب ما يُقال بكلماته قدر الإمكان. تُحفظ ملاحظاتك على هذا الجهاز أثناء الحديث."
            : "Sit with a grandparent, a neighbour or an old teacher and ask gently. Not every question needs an answer; write what is said in their words where you can. Your notes are kept on this device while you talk."}
        </p>
      </div>

      <ul className="grid gap-2 rounded-2xl border border-brand-amber/25 bg-brand-amber/5 p-4 text-xs leading-relaxed text-brand-text sm:grid-cols-3">
        <li><span className="font-bold">{isArabic ? "١. الإذن: " : "1. Consent: "}</span>{isArabic ? "اسأل إن كان يقبل أن تُحفظ ذكراه وتُنشر بعد المراجعة." : "Ask whether they agree to the memory being kept and published after review."}</li>
        <li><span className="font-bold">{isArabic ? "٢. التسجيل: " : "2. Recording: "}</span>{isArabic ? "سجّل بهاتفك فقط إن وافق، واحتفظ بالتسجيل لديك." : "Record on your phone only if they agree, and keep the recording yourself."}</li>
        <li><span className="font-bold">{isArabic ? "٣. الخصوصية: " : "3. Privacy: "}</span>{isArabic ? "لا تكتب أرقام هواتف أو عناوين أو أسماء أشخاص لم يأذنوا." : "Leave out phone numbers, addresses and names of people who did not agree."}</li>
      </ul>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1.5 text-sm">
          <span className="block font-bold text-brand-olive">{isArabic ? "المكان" : "Place"}</span>
          <select className={field} value={notes.locationId} onChange={(event) => setNotes({ ...notes, locationId: event.target.value })}>
            <option value="">{isArabic ? "اختر مكاناً…" : "Choose a place…"}</option>
            {locations.map((item) => (
              <option key={item.id} value={item.id}>
                {isArabic ? (locationById(item.id)?.arabicName ?? item.arabicName ?? item.name) : item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="block font-bold text-brand-olive">{isArabic ? "مع من تتحدث؟" : "Who are you talking to?"}</span>
          <input className={field} value={notes.who} maxLength={80} onChange={(event) => setNotes({ ...notes, who: event.target.value })} placeholder={isArabic ? "مثلاً: جدتي أم خليل" : "e.g. my grandmother Um Khalil"} />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="block font-bold text-brand-olive">{isArabic ? "عن أي زمن؟" : "Which years?"}</span>
          <input className={field} value={notes.when} maxLength={60} onChange={(event) => setNotes({ ...notes, when: event.target.value })} placeholder={isArabic ? "مثلاً: الستينيات" : "e.g. the 1960s"} />
        </label>
      </div>

      {notes.locationId ? (
        <ol className="space-y-4">
          {prompts.map((prompt, index) => (
            <li key={prompt.id} className="print-avoid-break space-y-1.5">
              <label htmlFor={`interview-${prompt.id}`} className="flex gap-2 text-sm font-bold text-brand-text">
                <span className="text-brand-amber">{index + 1}.</span>
                {isArabic ? prompt.ar : prompt.en}
              </label>
              <textarea
                id={`interview-${prompt.id}`}
                rows={3}
                maxLength={1500}
                className={`${field} print:min-h-24`}
                value={notes.answers[prompt.id] ?? ""}
                onChange={(event) => setAnswer(prompt.id, event.target.value)}
              />
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-brand-muted">{isArabic ? "اختر المكان لتظهر الأسئلة المناسبة له." : "Choose the place to see questions that fit it."}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <button
          type="button"
          disabled={!notes.locationId || answered.length === 0}
          onClick={useNotes}
          className="inline-flex items-center gap-2 rounded-full bg-brand-olive px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {isArabic
            ? `حوّل الإجابات إلى ذكرى${answered.length ? ` (${answered.length})` : ""}`
            : `Turn the answers into a memory${answered.length ? ` (${answered.length})` : ""}`}
        </button>
        {(answered.length > 0 || notes.who || notes.when) && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(isArabic ? "مسح الملاحظات والبدء بمقابلة جديدة؟" : "Clear these notes and start a new interview?")) {
                setNotes({ locationId: notes.locationId, who: "", when: "", answers: {} });
              }
            }}
            className="text-xs font-bold text-brand-muted hover:text-brand-olive"
          >
            {isArabic ? "مقابلة جديدة" : "New interview"}
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full border border-brand-border px-5 py-2.5 text-sm font-bold text-brand-olive"
        >
          <Printer className="h-4 w-4" />
          {isArabic ? "اطبع ورقة الأسئلة" : "Print the question sheet"}
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-brand-muted">
          <Mic className="h-3.5 w-3.5" />
          {isArabic ? "ستراجع النص قبل الإرسال." : "You review the text before sending."}
        </span>
      </div>
    </section>
  );
};
