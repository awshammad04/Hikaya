import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { HelpCircle, Loader2, PenLine, Quote, Send, Sparkles } from "lucide-react";
import { ApiLocation, ChatTurn, GuideAnswer, GuideCitation } from "../types";
import { askGuide, localArabicGuideAnswer, ApiError } from "../services/api";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById } from "../data/heritage";

interface HeritageChatProps {
  location: ApiLocation;
  scope?: {governorateIds:string[];locationIds:string[]};
  /** Questions offered as a starting point, tailored per location. */
  suggestions?: string[];
}

interface Message extends ChatTurn {
  id: string;
  answeredFromSource: boolean;
  excerpts: string[];
  citations: GuideCitation[];
  notes: string[];
}

const DEFAULT_SUGGESTIONS = [
  "What is the oldest thing here?",
  "Who built it?",
  "What can I see today?",
];

/**
 * Conversational heritage guide for one location.
 *
 * Two things make this different from a general chatbot, and both are visible
 * in the UI rather than only in the backend:
 *
 *  - answers are drawn from the reviewed content for this location, and the
 *    excerpts they came from are shown underneath;
 *  - when the records do not cover a question, it says so and invites the
 *    visitor to contribute what they know, instead of producing something
 *    plausible.
 */
export const HeritageChat: React.FC<HeritageChatProps> = ({
  location,
  suggestions = DEFAULT_SUGGESTIONS, scope,
}) => {
  const { isArabic, language } = useInterfaceLanguage();
  const profile = locationById(location.id);
  const displayName = isArabic ? (profile?.arabicName ?? location.arabicName ?? location.name) : location.name;
  const shownSuggestions = isArabic
    ? ["ما أهم ما يمكنني رؤيته هنا؟", "ما تاريخ هذا المكان؟", scope || location.governorateId && location.governorateId !== "jerusalem" ? "ما أهميته الثقافية؟" : "لماذا يُعد مهماً للقدس؟"]
    : suggestions;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [messages]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || asking) return;

    setAsking(true);
    setDraft("");

    // The backend resolves follow-ups ("and when?") against earlier turns, so
    // the conversation so far travels with the question.
    const history: ChatTurn[] = messages.map(({ question: q, answer }) => ({
      question: q,
      answer,
    }));

    let result: GuideAnswer;
    try {
      result = (await askGuide(location.id, trimmed, history, language, scope)).data;
      // Only the offline mock is replaced; real guide answers already come back
      // in the visitor's language.
      if (!scope && isArabic && result.generatedBy === "frontend-mock") {
        result = localArabicGuideAnswer(location.id, trimmed);
      }
    } catch (error) {
      result = !import.meta.env.PROD && isArabic && !scope && !(error instanceof ApiError && error.status && error.status < 500) ? localArabicGuideAnswer(location.id, trimmed) : {
        answer:
          error instanceof Error
            ? (isArabic ? `تعذر الوصول إلى الدليل: ${error.message}` : `The guide could not be reached: ${error.message}`)
            : (isArabic ? "تعذر الوصول إلى الدليل." : "The guide could not be reached."),
        answeredFromSource: false,
        excerpts: [],
        uncertaintyNotes: [],
        generatedBy: "error",
      };
    }

    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}`,
        question: trimmed,
        answer: result.answer,
        answeredFromSource: result.answeredFromSource,
        excerpts: result.excerpts,
        citations: result.citations ?? [],
        notes: result.uncertaintyNotes,
      },
    ]);
    setAsking(false);
  };

  return (
    <section className="bg-white rounded-3xl border border-brand-border p-6 space-y-4 shadow-sm">
      <div>
        <h3 className="font-serif font-black text-xl text-brand-olive flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-amber" />
          {isArabic ? `اسأل عن ${displayName}` : `Ask about ${location.name}`}
        </h3>
        <p className="text-xs text-brand-muted">
          {isArabic ? "تأتي الإجابات من السجلات المراجعة لهذا المكان، وحين لا تكفي يصرّح الدليل بذلك." : "Answers come from the reviewed records for this location. Where they fall short, the guide says so."}
        </p>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {shownSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void ask(suggestion)}
              className="text-xs font-serif px-4 py-2 rounded-full border border-brand-border hover:border-brand-amber text-brand-text transition-colors inline-flex items-center gap-1.5"
            >
              <HelpCircle className="w-3 h-3 text-brand-amber" />
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4 max-h-[26rem] overflow-y-auto">
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <p className="text-sm font-serif font-bold text-brand-olive">
              {message.question}
            </p>

            <div
              className={`rounded-2xl px-4 py-3 space-y-2 border ${
                message.answeredFromSource
                  ? "bg-brand-bg border-brand-border-light"
                  : "bg-brand-amber/5 border-brand-amber/30"
              }`}
            >
              <p className="text-sm text-brand-text leading-relaxed">{message.answer}</p>

              {message.excerpts.length > 0 && (
                <details className="pt-1">
                  <summary className="text-[10px] font-mono uppercase tracking-wider text-brand-muted cursor-pointer hover:text-brand-olive">
                    {isArabic ? `من السجلات (${message.excerpts.length})` : `From the records (${message.excerpts.length})`}
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {message.excerpts.map((excerpt, index) => (
                      <li
                        key={index}
                        className="text-xs text-brand-muted leading-relaxed flex gap-1.5"
                      >
                        <Quote className="w-3 h-3 shrink-0 mt-0.5 text-brand-amber" />
                        <span>
                          {message.citations[index] && (
                            <span className="block text-[10px] font-semibold text-brand-olive">
                              {message.citations[index].location_name
                                ? `${message.citations[index].location_name} · `
                                : ""}
                              {message.citations[index].section}
                              {message.citations[index].content_type !== "fact"
                                ? ` · ${message.citations[index].content_type}`
                                : ""}
                            </span>
                          )}
                          {excerpt}
                          {message.citations[index]?.references.map((reference) => (
                            <a
                              key={reference.url}
                              href={reference.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block mt-1 text-brand-olive underline"
                            >
                              {reference.title}
                            </a>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {message.notes.map((note, index) => (
                <p key={index} className="text-[10px] font-mono text-brand-muted">
                  {note}
                </p>
              ))}

              {/*
               * "Hikaya doesn't know" - turned into an invitation rather than a
               * dead end. An unanswered question is a gap in the archive, and
               * the person asking may be exactly who can close it.
               */}
              {!message.answeredFromSource && (
                <div className="pt-2 border-t border-brand-amber/20 space-y-2">
                  <p className="text-xs text-brand-text leading-relaxed">
                    {isArabic ? "تفضّل حكاية ترك فجوة على ملئها بمعلومة تبدو معقولة. إن كنت تعرف شيئاً من العائلة أو الحياة في المكان أو القراءة، فمكانه في الأرشيف." : "Hikaya would rather leave a gap than fill it with something plausible. If you know this — from family, from living here, from reading — it belongs in the archive."}
                  </p>
                  <Link
                    to={`/contribute?location=${location.id}`}
                    className="bg-brand-amber hover:bg-[#b45f05] text-white text-[10px] font-serif font-black tracking-widest uppercase px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition-colors"
                  >
                    <PenLine className="w-3 h-3" />
                    {isArabic ? "أضف ما تعرفه" : "Add what you know"}
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={isArabic ? `اسأل عن ${displayName}…` : `Ask something about ${location.name}…`}
          aria-label={isArabic ? `اسأل عن ${displayName}` : `Ask something about ${location.name}`}
          className="flex-1 bg-brand-bg border border-brand-border rounded-full px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-amber transition-colors"
        />
        <button
          type="submit"
          disabled={asking || !draft.trim()}
          aria-label={isArabic ? "إرسال السؤال" : "Send question"}
          className="bg-brand-olive hover:bg-[#4a4a35] disabled:opacity-50 text-brand-bg rounded-full p-3 transition-colors"
        >
          {asking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </section>
  );
};
