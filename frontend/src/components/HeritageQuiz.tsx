import React, { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Award, Check, FileText, RotateCcw, X } from "lucide-react";
import { ApiQuizQuestion } from "../types";
import { markQuizCompleted } from "../services/progress";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { localizeNationalQuiz } from "../data/heritage";
import { localizeQuiz } from "../arabicContent";

interface HeritageQuizProps {
  questions: ApiQuizQuestion[];
  locationName: string;
  locationId: string;
}

/**
 * A short quiz after the story.
 *
 * Every question shows, once answered, both the explanation and the place in
 * the reviewed content the answer comes from. That is deliberate: a quiz that
 * simply asserts "correct" is asking to be trusted, and this project does not
 * ask readers to take its word for anything.
 */
export const HeritageQuiz: React.FC<HeritageQuizProps> = ({
  questions,
  locationName,
  locationId,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const displayedQuestions = questions.map((question) => localizeNationalQuiz(localizeQuiz(question, isArabic), isArabic));

  if (!questions.length) {
    return (
      <p className="text-xs text-brand-muted font-serif italic">
        {isArabic ? "لم تُكتب أسئلة لهذا المكان بعد." : "No questions have been written for this location yet."}
      </p>
    );
  }

  const answered = Object.keys(answers).length;
  const correct = displayedQuestions.filter(
    (question) => answers[question.id] === question.answerIndex,
  ).length;

  const reset = () => {
    setAnswers({});
    setFinished(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <p className="text-xs text-brand-muted">
          {isArabic ? `${answered} من ${displayedQuestions.length} مجاب عنها` : `${answered} of ${displayedQuestions.length} answered`}
          {answered > 0 && (isArabic ? ` · ${correct} صحيحة` : ` · ${correct} right`)}
        </p>
        {answered > 0 && (
          <button
            type="button"
            onClick={reset}
            className="text-xs font-mono uppercase tracking-wider text-brand-muted hover:text-brand-olive inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3 h-3" />
            {isArabic ? "ابدأ من جديد" : "Start again"}
          </button>
        )}
      </div>

      {displayedQuestions.map((question, index) => {
        const chosen = answers[question.id];
        const hasAnswered = chosen !== undefined;

        return (
          <motion.div
            key={question.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.99 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-45px" }}
            transition={{ duration: reduced ? 0.15 : 0.38, delay: reduced ? 0 : index * 0.045, ease: "easeOut" }}
            whileHover={reduced ? undefined : { scale: 1.005 }}
            className="space-y-3 rounded-3xl border border-brand-border bg-white/80 p-5 shadow-sm transition-colors duration-300 hover:border-brand-amber/40 hover:bg-brand-surface hover:shadow-md"
          >
            <p className="font-serif font-bold text-sm text-brand-olive">
              {index + 1}. {question.question}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {question.options.map((option, optionIndex) => {
                const isChosen = chosen === optionIndex;
                const isAnswer = optionIndex === question.answerIndex;
                // Colour only appears after an answer, so the layout does not
                // leak which option is right.
                const tone = !hasAnswered
                  ? "border-brand-border hover:border-brand-amber text-brand-text"
                  : isAnswer
                    ? "border-green-500 bg-green-50 text-green-900"
                    : isChosen
                      ? "border-red-400 bg-red-50 text-red-900"
                      : "border-brand-border-light text-brand-muted";

                return (
                  <motion.button
                    key={optionIndex}
                    type="button"
                    disabled={hasAnswered}
                    whileHover={!reduced && !hasAnswered ? { y: -2, scale: 1.01 } : undefined}
                    whileTap={!reduced && !hasAnswered ? { scale: 0.985 } : undefined}
                    onClick={() => {
                      const next = { ...answers, [question.id]: optionIndex };
                      setAnswers(next);
                      if (Object.keys(next).length === displayedQuestions.length) {
                        setFinished(true);
                        markQuizCompleted(locationId);
                      }
                    }}
                    className={`inline-flex items-start gap-2 rounded-xl border px-4 py-2.5 text-start text-xs shadow-sm transition-all duration-200 enabled:cursor-pointer enabled:hover:bg-brand-surface enabled:hover:shadow-md disabled:cursor-default ${tone}`}
                  >
                    {hasAnswered && isAnswer && (
                      <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    {hasAnswered && isChosen && !isAnswer && (
                      <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    {option}
                  </motion.button>
                );
              })}
            </div>

            {hasAnswered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-1.5 pt-1"
              >
                <p className="text-xs text-brand-text leading-relaxed">
                  {question.explanation}
                </p>
                <p className="text-xs font-mono text-brand-muted flex items-start gap-1.5">
                  <FileText className="w-3 h-3 shrink-0 mt-0.5" />
                  {question.sourceNote}
                </p>
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {finished && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-bg border border-brand-amber/30 rounded-3xl p-5 text-center space-y-2"
        >
          <Award className="w-6 h-6 text-brand-amber mx-auto" />
          <p className="font-serif font-black text-lg text-brand-olive">
            {isArabic ? `${correct} من ${displayedQuestions.length}` : `${correct} out of ${displayedQuestions.length}`}
          </p>
          <p className="text-xs text-brand-muted">
            {correct === displayedQuestions.length
              ? (isArabic ? `أصبحت تعرف ${locationName} جيداً.` : `You have ${locationName} down.`)
              : (isArabic ? "توضح كل إجابة أعلاه أين يمكنك قراءة المزيد." : "The answers above each say where to read more.")}
          </p>
        </motion.div>
      )}
    </div>
  );
};
