import React, { useState } from "react";
import { ChevronDown, FileText, ShieldCheck } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { primarySourceTitle } from "../sourceMetadata";
import { SourceCitationLine } from "./SourceCitationLine";

interface TransparencyPanelProps {
  sourceFile?: string | null;
  summaryFile?: string | null;
  generatedBy: string;
  wordCount?: number;
  audience?: string;
  uncertaintyNotes: string[];
  queuedForReview?: boolean;
}

const BACKEND_LABELS: Record<string, string> = {
  anthropic: "a language model, under strict no-invention prompts",
  "offline-extractive":
    "Hikaya's offline generator, which only reuses sentences from the source",
  "backend-fallback":
    "the stored location description — the AI service could not be reached",
  "frontend-mock": "bundled sample data — the API could not be reached",
};

/**
 * Where a generated story came from, and what it could not say.
 *
 * Always attached to generated text, never collapsed away entirely. A reader
 * who cannot identify the public bibliography behind a claim, or see that the
 * records had a gap, has no way to check the platform's work.
 */
export const TransparencyPanel: React.FC<TransparencyPanelProps> = ({
  sourceFile,
  summaryFile,
  generatedBy,
  wordCount,
  audience,
  uncertaintyNotes,
  queuedForReview,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const [open, setOpen] = useState(false);
  const backendLabel = isArabic
    ? ({ anthropic: "نموذج لغوي يخضع لتعليمات صارمة تمنع الاختلاق", "offline-extractive": "المولّد الاستخراجي الذي يعيد استخدام نص المصدر فقط", "backend-fallback": "وصف المكان المخزّن بعد تعذر الوصول إلى خدمة الذكاء الاصطناعي", "frontend-mock": "المحتوى المرفق بعد تعذر الوصول إلى الواجهة", "arabic-reviewed-fallback": "صياغة عربية استخراجية من سجل المكان المراجع" }[generatedBy] ?? generatedBy)
    : (BACKEND_LABELS[generatedBy] ?? generatedBy);

  return (
    <section className="border border-brand-border-light rounded-2xl overflow-hidden">
      <div className="bg-brand-bg px-4 py-3 space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-brand-olive flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 text-brand-amber" />
          {isArabic ? "من أين جاءت هذه الحكاية؟" : "Where this came from"}
        </p>
        <p className="text-xs text-brand-text leading-relaxed">
          {isArabic ? <>كل معلومة أعلاه مستندة إلى المراجع الموثقة أدناه، وصاغها {backendLabel}.{queuedForReview && " وُضعت نسخة في قائمة فريق التوثيق قبل النشر."}</> : <>Every fact above is grounded in the reviewed bibliography below and written by {backendLabel}.{queuedForReview && " A copy has been queued for the documentation team before publication."}</>}
        </p>
        <SourceCitationLine sourceId={sourceFile ?? summaryFile} />
      </div>

      {uncertaintyNotes.length > 0 && (
        <div className="px-4 py-3 border-t border-brand-border-light space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-brand-muted">
            {isArabic ? "ما لا تغطيه السجلات" : "What the records do not cover"}
          </p>
          <ul className="text-xs text-brand-text leading-relaxed list-disc ps-4 space-y-1">
            {uncertaintyNotes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="w-full px-4 py-2 border-t border-brand-border-light text-[10px] font-mono uppercase tracking-wider text-brand-muted hover:text-brand-olive flex items-center justify-between transition-colors"
      >
        {isArabic ? "تفاصيل تقنية" : "Technical detail"}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <dl className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] font-mono text-brand-muted">
          {summaryFile && (
            <div className="sm:col-span-2 flex items-start gap-1.5">
              <FileText className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                <dt className="inline text-brand-olive">{isArabic ? "السجل المرجعي العام: " : "Public source record: "}</dt>
                <dd className="inline">{primarySourceTitle(summaryFile, undefined, isArabic)}</dd>
              </span>
            </div>
          )}
          <div>
            <dt className="inline text-brand-olive">{isArabic ? "المولّد: " : "Generator: "}</dt>
            <dd className="inline">{backendLabel}</dd>
          </div>
          {audience && (
            <div>
              <dt className="inline text-brand-olive">{isArabic ? "الجمهور: " : "Audience: "}</dt>
              <dd className="inline">{audience}</dd>
            </div>
          )}
          {wordCount !== undefined && (
            <div>
              <dt className="inline text-brand-olive">{isArabic ? "الطول: " : "Length: "}</dt>
              <dd className="inline">{wordCount} {isArabic ? "كلمة" : "words"}</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
};
