import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Flame, Lightbulb, X } from "lucide-react";
import { getQuiz } from "../services/api";
import type { ApiQuizQuestion } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorateName, localizeNationalQuiz, locationById, nationalRecord, scopedProfiles } from "../data/heritage";
import { localizeQuiz } from "../arabicContent";

const STORAGE_KEY = "hikaya.daily-question";

interface DailyRecord {
  /** Day key -> the option chosen that day. */
  answers: Record<string, number>;
}

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function hash(text: string) {
  return [...text].reduce((total, char) => (total * 33 + char.charCodeAt(0)) >>> 0, 5381);
}

function readRecord(): DailyRecord {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as DailyRecord | null;
    if (value?.answers && typeof value.answers === "object") return value;
  } catch {
    // Start a fresh record.
  }
  return { answers: {} };
}

/** Consecutive days, ending today, on which the question was answered. */
function streak(record: DailyRecord, today: Date) {
  let count = 0;
  const day = new Date(today);
  while (record.answers[dayKey(day)] !== undefined) {
    count += 1;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

/**
 * One question a day from the reviewed quizzes, the same for everyone that
 * day, rotating across places in every governorate. Answering shows the
 * explanation and its source and links to the place, and a small streak
 * invites a return visit tomorrow. Kept on the device; nothing is sent.
 */
export const DailyQuestion: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const today = useMemo(() => new Date(), []);
  const key = dayKey(today);
  const places = useMemo(() => scopedProfiles("all").map((place) => place.id).sort(), []);
  const placeId = places.length ? places[hash(key) % places.length] : "";
  const [question, setQuestion] = useState<ApiQuizQuestion | null>(null);
  const [record, setRecord] = useState<DailyRecord>(readRecord);

  useEffect(() => {
    if (!placeId) return;
    let cancelled = false;
    getQuiz(placeId)
      .then((result) => {
        if (cancelled || !result.data.length) return;
        setQuestion(result.data[hash(`${key}:${placeId}`) % result.data.length]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key, placeId]);

  if (!question) return null;
  const shown = localizeNationalQuiz(localizeQuiz(question, isArabic), isArabic);
  const chosen = record.answers[key];
  const answered = chosen !== undefined;
  const days = streak(record, today);
  const place = locationById(placeId);
  const placeName = place ? (isArabic ? (place.arabicName ?? place.name) : place.name) : placeId;
  const area = governorateName(nationalRecord(placeId)?.governorateId ?? "jerusalem", isArabic);

  const answer = (index: number) => {
    if (answered) return;
    const next = { answers: { ...record.answers, [key]: index } };
    // Keep about two months of history: enough for any realistic streak.
    const recent = Object.keys(next.answers).sort().slice(-60);
    next.answers = Object.fromEntries(recent.map((day) => [day, next.answers[day]]));
    setRecord(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Answering still works; the streak just is not remembered.
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-brand-border bg-brand-surface p-6 sm:p-8" aria-labelledby="daily-question-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-brand-amber">
          <Lightbulb className="h-4 w-4" />
          {isArabic ? `سؤال اليوم · ${placeName} · ${area}` : `Question of the day · ${placeName} · ${area}`}
        </p>
        {days > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-amber/40 bg-brand-amber/10 px-3 py-1 text-xs font-bold text-brand-olive">
            <Flame className="h-3.5 w-3.5 text-brand-amber" />
            {isArabic
              ? days === 1 ? "اليوم الأول في سلسلتك" : days === 2 ? "يومان متتاليان" : days <= 10 ? `${days} أيام متتالية` : `${days} يوماً متتالياً`
              : `${days}-day streak`}
          </span>
        )}
      </div>
      <h2 id="daily-question-title" className="font-serif text-xl font-black text-brand-olive">{shown.question}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {shown.options.map((option, index) => {
          const right = answered && index === shown.answerIndex;
          const wrong = answered && index === chosen && chosen !== shown.answerIndex;
          return (
            <button
              key={option}
              type="button"
              disabled={answered}
              onClick={() => answer(index)}
              aria-pressed={index === chosen}
              className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-start text-sm transition-colors ${
                right
                  ? "border-emerald-600 bg-emerald-600/10 font-bold"
                  : wrong
                    ? "border-red-600 bg-red-600/10"
                    : "border-brand-border hover:border-brand-amber enabled:cursor-pointer"
              }`}
            >
              {option}
              {right && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
              {wrong && <X className="h-4 w-4 shrink-0 text-red-600" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="space-y-2 border-t border-brand-border-light pt-4 text-sm" role="status">
          <p className="font-bold text-brand-text">
            {chosen === shown.answerIndex
              ? (isArabic ? "إجابة صحيحة!" : "Correct!")
              : (isArabic ? "ليست هذه. الإجابة الصحيحة مظلّلة." : "Not this time. The right answer is highlighted.")}
          </p>
          <p className="text-brand-muted">{shown.explanation}</p>
          {shown.sourceNote && <p className="text-xs text-brand-muted">{isArabic ? "المصدر: " : "Source: "}{shown.sourceNote}</p>}
          <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 font-bold">
            <Link to={`/locations/${placeId}`} className="text-brand-amber">{isArabic ? `اقرأ عن ${placeName} ←` : `Read about ${placeName} →`}</Link>
            <span className="text-xs font-normal text-brand-muted">{isArabic ? "سؤال جديد غداً." : "A new question tomorrow."}</span>
          </p>
        </div>
      )}
    </section>
  );
};
