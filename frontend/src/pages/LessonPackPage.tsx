import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { getLocation, getQuiz, getStories, getTimeline } from "../services/api";
import type { ApiLocation, ApiQuizQuestion, ApiStory, ApiTimelineEvent } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorateName, localizeNationalQuiz, localizeNationalTimeline, locationById } from "../data/heritage";
import { localizeQuiz, localizeTimeline } from "../arabicContent";
import { visitorWalkthrough } from "../visitorWalkthroughs";
import { readableNarrative } from "../utils/plainText";
import { SourceCitationLine } from "../components/SourceCitationLine";
import { NotFoundPage } from "./NotFoundPage";

interface LessonData {
  location: ApiLocation | null;
  stories: ApiStory[];
  timeline: ApiTimelineEvent[];
  quiz: ApiQuizQuestion[];
}

const LETTERS = { ar: ["أ", "ب", "ج", "د", "هـ", "و"], en: ["A", "B", "C", "D", "E", "F"] };

/** The same order on every print, so a class set of sheets matches one key. */
function classroomOrder<T extends { id: string }>(items: T[]): T[] {
  // FNV-1a: ids that differ in one character ("…-01", "…-02") still land far apart.
  const score = (id: string) =>
    [...id].reduce((total, char) => Math.imul(total ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const shuffled = [...items].sort((a, b) => score(a.id) - score(b.id));
  // Never hand out a sheet that is already in the right order.
  return shuffled.every((item, index) => item.id === items[index].id) && items.length > 1
    ? [...shuffled.slice(1), shuffled[0]]
    : shuffled;
}

const Section: React.FC<React.PropsWithChildren<{ number: number; title: string; className?: string }>> = ({
  number,
  title,
  className = "",
  children,
}) => (
  <section className={`space-y-4 ${className}`}>
    <h2 className="flex items-center gap-3 font-serif text-xl font-black text-brand-olive">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-brand-olive text-sm">{number}</span>
      {title}
    </h2>
    {children}
  </section>
);

/**
 * A printable lesson for teachers: the reviewed story to read aloud, a
 * timeline-ordering activity, a quiz worksheet, discussion and family
 * homework, and the answer key on its own page. Everything comes from the same
 * reviewed records as the place page, so a class works only with documented
 * content and learns to tell history from tradition.
 */
export const LessonPackPage: React.FC = () => {
  const { locationId = "" } = useParams<{ locationId: string }>();
  const { isArabic } = useInterfaceLanguage();
  const [data, setData] = useState<LessonData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    void Promise.all([getLocation(locationId), getStories(locationId), getTimeline(locationId), getQuiz(locationId)])
      .then(([location, stories, timeline, quiz]) => {
        if (cancelled) return;
        setData({ location: location.data, stories: stories.data, timeline: timeline.data, quiz: quiz.data });
      })
      .catch(() => {
        if (!cancelled) setData({ location: null, stories: [], timeline: [], quiz: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  if (!data) {
    return (
      <div className="flex items-center gap-3 py-16 text-brand-muted" role="status">
        <Loader2 className="h-5 w-5 animate-spin" />
        {isArabic ? "نجهّز الدرس…" : "Preparing the lesson…"}
      </div>
    );
  }
  if (!data.location) return <NotFoundPage />;

  const { location } = data;
  const profile = locationById(location.id);
  const name = isArabic ? (profile?.arabicName ?? location.arabicName ?? location.name) : location.name;
  const place = governorateName(location.governorateId ?? "jerusalem", isArabic);
  const story = data.stories[0];
  const storyText = visitorWalkthrough(location.id, isArabic)
    ?? (isArabic ? (profile?.arabicStory ?? story?.simplifiedStory) : (profile?.story ?? story?.simplifiedStory))
    ?? "";
  const reading = readableNarrative(storyText);
  const timeline: ApiTimelineEvent[] = data.timeline
    .map((event) => localizeNationalTimeline(localizeTimeline(event, isArabic), isArabic))
    .sort((a, b) => a.sortYear - b.sortYear || a.sortOrder - b.sortOrder);
  const shuffledTimeline = classroomOrder<ApiTimelineEvent>(timeline);
  const quiz = data.quiz.map((question) => localizeNationalQuiz(localizeQuiz(question, isArabic), isArabic));
  const letters = isArabic ? LETTERS.ar : LETTERS.en;
  let part = 0;
  const next = () => ++part;

  return (
    <article className="paper-scope mx-auto max-w-3xl space-y-10 rounded-3xl border border-brand-border bg-brand-surface p-6 sm:p-10 print:rounded-none print:border-0 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to={`/locations/${location.id}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-muted hover:text-brand-olive">
          <ArrowLeft className={`h-4 w-4 ${isArabic ? "rotate-180" : ""}`} />
          {isArabic ? "العودة إلى المكان" : "Back to the place"}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-brand-olive px-5 py-2.5 text-sm font-bold text-white"
        >
          <Printer className="h-4 w-4" />
          {isArabic ? "اطبع الدرس أو احفظه PDF" : "Print or save as PDF"}
        </button>
      </div>

      <header className="space-y-2 border-b-2 border-brand-olive pb-5">
        <p className="font-mono text-xs uppercase tracking-widest text-brand-amber">
          {isArabic ? "حكاية · حزمة درس" : "Hikaya · Lesson pack"}
        </p>
        <h1 className="font-serif text-3xl font-black text-brand-olive">{name}</h1>
        <p className="text-sm text-brand-muted">
          {place} · {isArabic ? "حصة واحدة (نحو 45 دقيقة) · من المحتوى المراجع فقط" : "One lesson (about 45 minutes) · reviewed content only"}
        </p>
        <div className="grid gap-3 pt-2 text-sm sm:grid-cols-2">
          <p><span className="font-bold">{isArabic ? "الاسم:" : "Name:"}</span> ____________________</p>
          <p><span className="font-bold">{isArabic ? "الصف والتاريخ:" : "Class & date:"}</span> ______________</p>
        </div>
      </header>

      <section className="print-avoid-break space-y-3 rounded-2xl border border-brand-border-light p-5 text-sm">
        <h2 className="font-serif text-lg font-black text-brand-olive">{isArabic ? "للمعلّم" : "For the teacher"}</h2>
        <ul className="list-disc space-y-1 ps-5 text-brand-text">
          {(isArabic
            ? [
                `أن يصف الطلاب ${name} ومكانه في ${place} بلغتهم.`,
                "أن يرتّبوا أحداث المكان على خط زمني ويستدلّوا بالمصدر.",
                "أن يميّزوا بين التاريخ الموثّق والتقليد الديني أو الرواية الشفوية.",
              ]
            : [
                `Students describe ${name} and where it sits in ${place}, in their own words.`,
                "They order the place's events on a timeline and cite the source.",
                "They tell documented history apart from religious tradition and oral account.",
              ]
          ).map((goal) => <li key={goal}>{goal}</li>)}
        </ul>
        <p className="text-brand-muted">
          {isArabic
            ? "مسار مقترح: ٥ دقائق تمهيد بصورة المكان · ١٥ دقيقة قراءة (أو استماع للراوي على الموقع) · ١٠ دقائق خط زمني · ١٠ دقائق أسئلة · ٥ دقائق نقاش."
            : "Suggested flow: 5 min warm-up with a photo of the place · 15 min reading (or the site's narrator) · 10 min timeline · 10 min questions · 5 min discussion."}
        </p>
      </section>

      {reading.text && (
        <Section number={next()} title={isArabic ? "اقرأ الحكاية" : "Read the story"}>
          <div className="space-y-4 text-[15px] leading-loose text-brand-text">
            {reading.text.split(/\n{2,}/).map((paragraph, index) => {
              const [first, ...rest] = paragraph.split("\n");
              const headed = rest.length > 0 && (reading.headings.has(first.trim()) || (first.trim().split(/\s+/).length <= 8 && !/[.؟?!،,;؛…]$/.test(first.trim())));
              return (
                <p key={index} className="print-avoid-break whitespace-pre-line">
                  {headed ? <span className="mb-1 block font-serif text-lg font-black text-brand-olive">{first}</span> : first}
                  {rest.length > 0 && (headed ? rest.join("\n") : `\n${rest.join("\n")}`)}
                </p>
              );
            })}
          </div>
          {story?.source && <SourceCitationLine sourceId={story.source} locationId={location.id} />}
        </Section>
      )}

      {shuffledTimeline.length > 1 && (
        <Section number={next()} title={isArabic ? "رتّب الأحداث" : "Put the events in order"} className="print-avoid-break">
          <p className="text-sm text-brand-muted">
            {isArabic ? "اكتب في المربع رقماً من 1 (الأقدم) إلى " : "Write a number in each box, from 1 (earliest) to "}
            {shuffledTimeline.length}
            {isArabic ? " (الأحدث). ما وُسم «تقليد» يُروى ولا يثبته توثيق." : " (latest). Items marked “tradition” are told, not documented."}
          </p>
          <ol className="space-y-2">
            {shuffledTimeline.map((event) => (
              <li key={event.id} className="flex items-start gap-3 rounded-xl border border-brand-border-light p-3 text-sm">
                <span className="h-8 w-8 shrink-0 rounded-md border-2 border-brand-olive" aria-hidden="true" />
                <span>
                  {event.description}
                  {event.isTradition && (
                    <span className="ms-2 rounded-full border border-brand-amber/40 px-2 py-0.5 text-xs font-bold text-brand-amber">
                      {isArabic ? "تقليد" : "tradition"}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {quiz.length > 0 && (
        <Section number={next()} title={isArabic ? "أسئلة الفهم" : "Check your understanding"}>
          <ol className="space-y-5">
            {quiz.map((question, index) => (
              <li key={question.id} className="print-avoid-break space-y-2">
                <p className="font-bold text-brand-text">{index + 1}. {question.question}</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <li key={option} className="flex items-center gap-2 text-sm">
                      <span className="h-4 w-4 shrink-0 rounded-full border-2 border-brand-olive" aria-hidden="true" />
                      <span className="font-bold">{letters[optionIndex]}.</span> {option}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section number={next()} title={isArabic ? "نقاش وواجب" : "Discuss and take home"} className="print-avoid-break">
        <ul className="list-disc space-y-2 ps-5 text-sm text-brand-text">
          {(isArabic
            ? [
                "ما الذي بقي في هذا المكان على حاله، وما الذي تغيّر؟ ما الدليل في النص؟",
                "اختر جملة من الحكاية: هل هي من وثيقة، أم من تقليد، أم من ذاكرة الناس؟ كيف عرفت؟",
                "لو التقيت شخصاً عاش هنا قبل خمسين عاماً، ما السؤال الذي ستسأله؟",
              ]
            : [
                "What has stayed the same in this place, and what has changed? What in the text shows it?",
                "Pick a sentence from the story: does it come from a document, a tradition or people's memory? How can you tell?",
                "If you met someone who lived here fifty years ago, what would you ask them?",
              ]
          ).map((prompt) => <li key={prompt}>{prompt}</li>)}
        </ul>
        <p className="rounded-2xl border border-dashed border-brand-amber/50 p-4 text-sm text-brand-text">
          <span className="font-bold">{isArabic ? "واجب منزلي: " : "Homework: "}</span>
          {isArabic
            ? "اسأل أحد كبار العائلة عن مكان يتذكّره في فلسطين، مستعيناً بدليل المقابلة على حكاية، ثم شارك الذكرى ليحفظها الأرشيف بعد المراجعة."
            : "Interview an elder in your family about a place they remember in Palestine, using Hikaya's interview guide, then share the memory so the archive can keep it after review."}
          <span className="mt-1 block font-mono text-xs text-brand-muted" dir="ltr">
            {typeof window !== "undefined" ? window.location.origin : ""}/contribute?location={location.id}&amp;interview=1
          </span>
        </p>
      </Section>

      {(quiz.length > 0 || shuffledTimeline.length > 1) && (
        <section className="print-break-before space-y-4 border-t-2 border-dashed border-brand-border pt-8 print:border-0 print:pt-0">
          <h2 className="font-serif text-xl font-black text-brand-olive">{isArabic ? "مفتاح الإجابات (للمعلّم)" : "Answer key (teacher)"}</h2>
          {shuffledTimeline.length > 1 && (
            <div className="space-y-1 text-sm">
              <p className="font-bold">{isArabic ? "ترتيب الأحداث:" : "Event order:"}</p>
              <ol className="list-decimal space-y-1 ps-5">
                {timeline.map((event) => (
                  <li key={event.id}>
                    <span className="font-bold">{event.periodLabel}</span> — {event.description}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {quiz.length > 0 && (
            <ol className="space-y-3 text-sm">
              {quiz.map((question, index) => (
                <li key={question.id} className="print-avoid-break">
                  <p>
                    <span className="font-bold">{index + 1}. {letters[question.answerIndex]}</span> — {question.options[question.answerIndex]}
                  </p>
                  <p className="text-brand-muted">{question.explanation}</p>
                  {question.sourceNote && <p className="text-xs text-brand-muted">{isArabic ? "المصدر: " : "Source: "}{question.sourceNote}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </article>
  );
};
