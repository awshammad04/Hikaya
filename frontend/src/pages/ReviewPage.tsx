import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, ExternalLink, EyeOff, Inbox, Loader2, Mail, ShieldCheck, UserRound, XCircle } from "lucide-react";
import { PageTransition } from "../components/motion";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { governorateName, locationById, nationalRecord } from "../data/heritage";
import {
  AccountError,
  ContributionStatus,
  isReviewerRole,
  reviewApi,
  ReviewItem,
  ReviewQueue,
} from "../services/accountSync";

const TABS: { id: ContributionStatus; en: string; ar: string; icon: typeof Clock }[] = [
  { id: "pending_review", en: "Waiting", ar: "بانتظار المراجعة", icon: Clock },
  { id: "approved", en: "Public", ar: "منشورة", icon: CheckCircle2 },
  { id: "rejected", en: "Rejected", ar: "مرفوضة", icon: XCircle },
];

/**
 * The review queue for editors and admins. Visitors' public stories land here
 * as "waiting"; approving one publishes it on its place page for everyone,
 * rejecting one needs a note, which the writer sees on their status lookup.
 */
export const ReviewPage: React.FC = () => {
  const { isArabic, language } = useInterfaceLanguage();
  const { status, user } = useAuth();
  const [tab, setTab] = useState<ContributionStatus>("pending_review");
  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reviewer = status === "signed-in" && isReviewerRole(user?.role);

  const load = useCallback(async (which: ContributionStatus) => {
    setLoadError(null);
    try {
      setQueue(await reviewApi.queue(which));
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "The review queue could not be loaded.");
    }
  }, []);

  useEffect(() => {
    if (!reviewer) return;
    setQueue(null);
    void load(tab);
  }, [reviewer, tab, load]);

  if (status === "loading") {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-brand-olive" /></div>;
  }

  if (!reviewer) {
    return (
      <PageTransition>
        <div className="mx-auto max-w-lg rounded-3xl border border-brand-border bg-brand-surface p-8 text-center space-y-4">
          <ShieldCheck className="w-10 h-10 mx-auto text-brand-amber" />
          <h1 className="font-serif font-black text-2xl text-brand-olive">{isArabic ? "مراجعة الحكايات" : "Story review"}</h1>
          <p className="text-sm text-brand-muted leading-relaxed">
            {status === "signed-in"
              ? (isArabic ? "هذه الصفحة لفريق المراجعة فقط، وحسابك ليس حساب مشرف." : "This page is for the review team only, and your account is not a reviewer account.")
              : (isArabic ? "سجّل الدخول بحساب مشرف لمراجعة الحكايات المرسلة." : "Sign in with a reviewer account to review submitted stories.")}
          </p>
          {status !== "signed-in" && (
            <Link to="/account?mode=login" className="inline-block rounded-full bg-brand-olive px-6 py-2.5 text-xs font-bold text-white">{isArabic ? "تسجيل الدخول" : "Sign in"}</Link>
          )}
        </div>
      </PageTransition>
    );
  }

  const dateFormat = language === "ar" ? "ar-PS" : "en-GB";

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-brand-amber">{isArabic ? "لوحة المشرف" : "Admin"}</p>
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-brand-olive">{isArabic ? "مراجعة الحكايات" : "Story review"}</h1>
          <p className="text-sm text-brand-muted leading-relaxed">
            {isArabic
              ? "حكايات طلب أصحابها نشرها. الموافقة تنشرها في صفحة المكان لكل الزوار، والرفض يحتاج ملاحظة يراها الكاتب."
              : "Stories their writers asked to make public. Approving publishes it on the place page for every visitor; rejecting needs a note the writer will see."}
          </p>
        </div>

        <div role="tablist" aria-label={isArabic ? "حالة الحكايات" : "Story status"} className="flex flex-wrap gap-2">
          {TABS.map(({ id, en, ar, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-full border px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 ${tab === id ? "border-brand-olive bg-brand-olive text-white" : "border-brand-border bg-brand-surface text-brand-olive hover:border-brand-amber"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {isArabic ? ar : en}
              {queue && <span className={`rounded-full px-2 ${tab === id ? "bg-white/20" : "bg-brand-bg"}`}>{queue.counts[id]}</span>}
            </button>
          ))}
        </div>

        {loadError ? (
          <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</p>
        ) : !queue ? (
          <Loader2 className="w-6 h-6 animate-spin text-brand-olive" />
        ) : queue.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-brand-border p-10 text-center space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-brand-muted" />
            <p className="text-sm text-brand-muted">
              {tab === "pending_review"
                ? (isArabic ? "لا توجد حكايات بانتظار المراجعة." : "Nothing is waiting for review.")
                : (isArabic ? "لا شيء هنا بعد." : "Nothing here yet.")}
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {queue.items.map((item) => (
              <ReviewCard key={item.id} item={item} dateFormat={dateFormat} onDone={() => void load(tab)} />
            ))}
          </ul>
        )}
      </div>
    </PageTransition>
  );
};

const ReviewCard: React.FC<{ item: ReviewItem; dateFormat: string; onDone: () => void }> = ({ item, dateFormat, onDone }) => {
  const { isArabic } = useInterfaceLanguage();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const place = locationById(item.locationId);
  const governorateId = nationalRecord(item.locationId)?.governorateId ?? "jerusalem";

  const decide = async (decision: "approved" | "rejected") => {
    if (decision === "rejected" && !notes.trim()) {
      setError(isArabic ? "اكتب ملاحظة قصيرة توضح سبب الرفض." : "Add a short note explaining why it is rejected.");
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      await reviewApi.review(item.id, decision, notes);
      onDone();
    } catch (caught) {
      setError(caught instanceof AccountError || caught instanceof Error ? caught.message : String(caught));
      setBusy(null);
    }
  };

  return (
    <li className="rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <Link to={`/locations/${item.locationId}`} className="text-xs font-bold text-brand-amber hover:underline">
            {place ? (isArabic ? place.arabicName : place.name) : item.locationId} · {governorateName(governorateId, isArabic)}
          </Link>
          <h2 className="font-serif font-black text-xl text-brand-olive">{item.title}</h2>
        </div>
        <p className="text-xs text-brand-muted text-end">
          {new Date(item.submittedAt).toLocaleString(dateFormat, { dateStyle: "medium", timeStyle: "short" })}
          {item.referenceCode && <span className="block font-mono" dir="ltr">{item.referenceCode}</span>}
        </p>
      </div>

      <p className="text-sm text-brand-text leading-loose whitespace-pre-line">{item.content}</p>

      {item.mediaUrl && (
        <a href={item.mediaUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-amber break-all">
          <ExternalLink className="w-3.5 h-3.5 shrink-0" />{item.mediaType ? `${item.mediaType}: ` : ""}{item.mediaUrl}
        </a>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-brand-muted border-t border-brand-border-light pt-3">
        <span className="inline-flex items-center gap-1.5">
          {item.contributorName ? <UserRound className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {item.contributorName
            ? (isArabic ? `يُنشر باسم: ${item.contributorName}` : `Credited as: ${item.contributorName}`)
            : (isArabic ? "شارك الحكاية فقط (دون اسم)" : "Shared only the story (anonymous)")}
        </span>
        {item.contributorEmail && (
          <a href={`mailto:${item.contributorEmail}`} className="inline-flex items-center gap-1.5 hover:text-brand-olive" dir="ltr">
            <Mail className="w-3.5 h-3.5" />{item.contributorEmail}
          </a>
        )}
      </div>

      {item.status !== "pending_review" && item.reviewNotes && (
        <p className="rounded-xl bg-brand-bg px-3 py-2 text-xs text-brand-muted">
          <span className="font-bold">{isArabic ? "ملاحظة المراجعة: " : "Review note: "}</span>{item.reviewNotes}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor={`notes-${item.id}`} className="sr-only">{isArabic ? "ملاحظة للكاتب" : "Note to the writer"}</label>
        <textarea
          id={`notes-${item.id}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={2000}
          placeholder={isArabic ? "ملاحظة للكاتب (مطلوبة عند الرفض)" : "Note to the writer (required to reject)"}
          className="w-full min-h-16 resize-y rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm focus:border-brand-amber focus:outline-none"
        />
        {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {item.status !== "approved" && (
            <button type="button" disabled={busy !== null} onClick={() => void decide("approved")} className="rounded-full bg-emerald-700 hover:bg-emerald-800 px-5 py-2 text-xs font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-50">
              {busy === "approved" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {isArabic ? "وافق وانشر" : "Approve and publish"}
            </button>
          )}
          {item.status !== "rejected" && (
            <button type="button" disabled={busy !== null} onClick={() => void decide("rejected")} className="rounded-full border border-red-300 bg-brand-surface hover:bg-red-50 px-5 py-2 text-xs font-bold text-red-800 inline-flex items-center gap-1.5 disabled:opacity-50">
              {busy === "rejected" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              {item.status === "approved" ? (isArabic ? "أزلها من النشر" : "Unpublish") : (isArabic ? "ارفض" : "Reject")}
            </button>
          )}
        </div>
      </div>
    </li>
  );
};
