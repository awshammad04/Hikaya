import React, { useState } from "react";
import { motion } from "motion/react";
import { Clock, Loader2, Search, ShieldCheck, XCircle } from "lucide-react";
import { ContributionStatus } from "../types";
import { getContributionStatus } from "../services/api";
import { useInterfaceLanguage } from "../context/LanguageContext";

const STATUS_STYLE: Record<
  ContributionStatus["status"],
  { icon: React.ElementType; className: string; label: string }
> = {
  pending_review: {
    icon: Clock,
    className: "bg-brand-amber/5 border-brand-amber/30 text-brand-amber",
    label: "Waiting for review",
  },
  approved: {
    icon: ShieldCheck,
    className: "bg-green-50 border-green-200 text-green-800",
    label: "Published",
  },
  rejected: {
    icon: XCircle,
    className: "bg-red-50 border-red-200 text-red-800",
    label: "Not published",
  },
};

/**
 * Lets a contributor check what happened to their memory.
 *
 * Contributions are anonymous, so the reference code handed out at submission
 * is the only thread back to them. Without this the review queue would be a
 * place memories go and are never heard from again, which is a poor way to
 * treat something someone chose to give you.
 */
export const ContributionStatusLookup: React.FC = () => {
  const { isArabic, language } = useInterfaceLanguage();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<ContributionStatus | null>(null);
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const look = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || looking) return;

    setLooking(true);
    setError(null);
    setStatus(null);
    try {
      setStatus(await getContributionStatus(code));
    } catch (caught) {
      setError(isArabic
        ? "تعذر التحقق من الحالة الآن. تأكد من الرمز واتصال الخادم ثم حاول مجدداً."
        : caught instanceof Error ? caught.message : "The status could not be looked up right now.");
    } finally {
      setLooking(false);
    }
  };

  const style = status ? STATUS_STYLE[status.status] : null;
  const StatusIcon = style?.icon;

  return (
    <section className="bg-white rounded-3xl border border-brand-border p-6 space-y-4 shadow-sm">
      <div>
        <h3 className="font-serif font-black text-lg text-brand-olive">
          {isArabic ? "هل أرسلت ذكرى من قبل؟" : "Already sent something?"}
        </h3>
        <p className="text-xs text-brand-muted">
          {isArabic ? "أدخل رمز المتابعة الموجود في الإيصال لمعرفة حالة الذكرى." : "Enter the reference code from your receipt to see where it got to."}
        </p>
      </div>

      <form onSubmit={look} className="flex items-center gap-2">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="HK-XXXXXX"
          aria-label={isArabic ? "رمز متابعة المساهمة" : "Contribution reference code"}
          className="flex-1 bg-brand-bg border border-brand-border rounded-full px-4 py-2.5 text-sm font-mono tracking-wider text-brand-text uppercase focus:outline-none focus:border-brand-amber transition-colors"
        />
        <button
          type="submit"
          disabled={looking || !code.trim()}
          className="bg-brand-olive hover:bg-[#4a4a35] disabled:opacity-50 text-brand-bg rounded-full p-3 transition-colors"
          aria-label={isArabic ? "تحقق من المساهمة" : "Look up contribution"}
        >
          {looking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </button>
      </form>

      {error && (
        <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      {status && style && StatusIcon && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border px-4 py-4 space-y-2 ${style.className}`}
        >
          <p className="text-[10px] font-mono uppercase tracking-widest inline-flex items-center gap-1.5">
            <StatusIcon className="w-3 h-3" />
            {isArabic ? ({ pending_review: "بانتظار المراجعة", approved: "منشورة", rejected: "غير منشورة" }[status.status]) : style.label}
          </p>
          <p className="font-serif font-bold text-sm text-brand-olive">{status.title}</p>
          <p className="text-xs text-brand-text leading-relaxed">{isArabic ? ({ pending_review: "وصلت المساهمة وهي بانتظار مراجعة فريق التوثيق.", approved: "راجع فريق التوثيق المساهمة ونُشرت في أرشيف الذاكرة الحية.", rejected: "راجع فريق التوثيق المساهمة ولم تُنشر." }[status.status]) : status.message}</p>
          {status.reviewNotes && (
            <p className="text-xs text-brand-text leading-relaxed border-t border-current/20 pt-2">
              <span className="font-bold">{isArabic ? "ملاحظة فريق التوثيق:" : "Reviewer note:"}</span> {status.reviewNotes}
            </p>
          )}
          <p className="text-[10px] font-mono opacity-70">
            {isArabic ? "أُرسلت " : "Submitted "}{new Date(status.submittedAt).toLocaleDateString(language === "ar" ? "ar-PS" : "en-GB")}
            {status.reviewedAt && (isArabic ? ` · روجعت ${new Date(status.reviewedAt).toLocaleDateString("ar-PS")}` : ` · reviewed ${new Date(status.reviewedAt).toLocaleDateString("en-GB")}`)}
          </p>
        </motion.div>
      )}
    </section>
  );
};
