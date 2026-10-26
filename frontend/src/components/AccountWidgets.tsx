import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CloudUpload, PartyPopper, ShieldCheck, UserRound, X } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import {
  isReviewerRole,
  journeyTotals,
  MEMORIES_EVENT,
  MergeSummary,
  PROGRESS_EVENT,
  REVIEW_EVENT,
  reviewApi,
  STORIES_EVENT,
} from "../services/accountSync";

const NUDGE_DISMISSED_KEY = "hikaya.save-nudge-dismissed";

/** Same footprint as the header's other round buttons. */
const compactChip =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface text-brand-olive transition-colors hover:border-brand-olive";

/**
 * Header entry point: the guest passport, or the signed-in visitor. A round
 * button until extra-wide screens, where the header has room for names.
 */
export const AccountChip: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { status, user, guest } = useAuth();
  if (status === "loading") return null;
  if (status === "signed-in" && user) {
    const firstName = user.fullName.split(/\s+/)[0];
    return (
      <Link to="/me" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-brand-border bg-brand-surface p-1 xl:pe-3 text-xs font-bold text-brand-olive whitespace-nowrap transition-colors hover:border-brand-olive" aria-label={isArabic ? "جواز سفري" : "My passport"}>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-olive text-sm text-white">{firstName.charAt(0).toUpperCase()}</span>
        <span className="hidden xl:inline">{firstName}</span>
      </Link>
    );
  }
  const guestLabel = isArabic ? `${guest.ar} · جواز سفر الضيف` : `${guest.en} · guest passport`;
  return (
    <>
      <Link to="/me" className={`${compactChip} xl:hidden`} aria-label={guestLabel} title={guestLabel}>
        <UserRound className="w-4 h-4" />
      </Link>
      <span className="hidden xl:inline-flex h-10 shrink-0 items-center rounded-full border border-brand-border bg-brand-surface p-1 text-xs font-bold whitespace-nowrap">
        <Link to="/me" className="ps-3 pe-2 text-brand-muted hover:text-brand-olive" title={guestLabel}>
          {isArabic ? guest.ar : guest.en}
        </Link>
        <Link to="/account?mode=login" className="rounded-full bg-brand-olive px-3 py-2 text-white">
          {isArabic ? "دخول" : "Sign in"}
        </Link>
      </span>
    </>
  );
};

/** How many public stories are waiting; null for anyone who is not a reviewer. */
export function usePendingReviews(): number | null {
  const { status, user } = useAuth();
  const { pathname } = useLocation();
  const reviewer = status === "signed-in" && isReviewerRole(user?.role);
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    if (!reviewer) {
      setPending(null);
      return;
    }
    let cancelled = false;
    const update = () => {
      reviewApi.queue("pending_review")
        .then((queue) => { if (!cancelled) setPending(queue.counts.pending_review); })
        .catch(() => undefined);
    };
    update();
    window.addEventListener(REVIEW_EVENT, update);
    return () => {
      cancelled = true;
      window.removeEventListener(REVIEW_EVENT, update);
    };
  }, [reviewer, pathname]);
  return pending;
}

/**
 * Header shortcut to the review queue, shown to editors and admins only.
 * Hidden between lg and xl, where the header has no room; the passport links
 * to the queue there.
 */
export const ReviewChip: React.FC<{ pending: number | null }> = ({ pending }) => {
  const { isArabic } = useInterfaceLanguage();
  if (pending === null) return null;
  const label = isArabic ? `مراجعة الحكايات · ${pending} بانتظارك` : `Review stories · ${pending} waiting`;
  return (
    <Link to="/admin/review" className={`${compactChip} relative lg:hidden xl:inline-flex`} aria-label={label} title={label}>
      <ShieldCheck className="w-4 h-4" />
      {pending > 0 && (
        <span className="absolute -top-1 -end-1 min-w-5 h-5 rounded-full bg-brand-amber px-1 text-[11px] font-bold leading-5 text-white text-center">
          {pending > 99 ? "99+" : pending}
        </span>
      )}
    </Link>
  );
};

function useJourneyTotals() {
  const [totals, setTotals] = useState(journeyTotals);
  useEffect(() => {
    const update = () => setTotals(journeyTotals());
    const events = [PROGRESS_EVENT, MEMORIES_EVENT, STORIES_EVENT, "storage"];
    events.forEach((name) => window.addEventListener(name, update));
    return () => events.forEach((name) => window.removeEventListener(name, update));
  }, []);
  return totals;
}

function summaryLine(summary: MergeSummary, arabic: boolean) {
  const parts = [
    [summary.places, "أماكن", "place", "places"],
    [summary.quizzes, "اختبارات", "quiz", "quizzes"],
    [summary.narrations, "حكايات مسموعة", "narration", "narrations"],
    [summary.photos, "صور", "photo", "photos"],
    [summary.stories, "حكايات محفوظة", "saved story", "saved stories"],
  ] as const;
  return parts
    .filter(([count]) => count > 0)
    .map(([count, ar, one, many]) => `${count} ${arabic ? ar : count === 1 ? one : many}`)
    .join(" · ");
}

/**
 * Two gentle toasts: a guest who has built up a journey is invited (once per
 * session) to save it, and a visitor who just signed in is told what came
 * along from their guest journey.
 */
export const AccountToasts: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { status, user, lastMerge, dismissMerge } = useAuth();
  const { pathname } = useLocation();
  const totals = useJourneyTotals();
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(NUDGE_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const dismissNudge = () => {
    setNudgeDismissed(true);
    try {
      window.sessionStorage.setItem(NUDGE_DISMISSED_KEY, "1");
    } catch {
      // Dismissed for this page view only.
    }
  };

  const merged = lastMerge ? summaryLine(lastMerge, isArabic) : "";
  if (status === "signed-in" && lastMerge) {
    return (
      <Toast onClose={dismissMerge} icon={<PartyPopper className="w-5 h-5 text-brand-amber" />}>
        <p className="font-bold text-brand-olive">
          {isArabic ? `أهلاً ${user?.fullName.split(/\s+/)[0] ?? ""}!` : `Welcome, ${user?.fullName.split(/\s+/)[0] ?? ""}!`}
        </p>
        <p className="text-xs text-brand-text">
          {merged
            ? (isArabic ? `انتقلت رحلتك كضيف إلى حسابك: ${merged}.` : `Your guest journey is now in your account: ${merged}.`)
            : (isArabic ? "رحلتك محفوظة في حسابك ومتزامنة على هذا الجهاز." : "Your journey is saved to your account and synced on this device.")}
        </p>
        <Link to="/me" onClick={dismissMerge} className="text-xs font-bold text-brand-amber">{isArabic ? "افتح جواز سفري ←" : "Open my passport →"}</Link>
      </Toast>
    );
  }

  const worthSaving = totals.places >= 3 || totals.photos > 0 || totals.stories > 0;
  if (status !== "guest" || !worthSaving || nudgeDismissed || pathname === "/account" || pathname === "/me") return null;
  return (
    <Toast onClose={dismissNudge} icon={<CloudUpload className="w-5 h-5 text-brand-amber" />}>
      <p className="font-bold text-brand-olive">{isArabic ? "رحلتك تكبر!" : "Your journey is growing!"}</p>
      <p className="text-xs text-brand-text">
        {isArabic
          ? `جمعت ${summaryLine(totals, true)}، وكلها محفوظة في هذا المتصفح فقط.`
          : `You have ${summaryLine(totals, false)} — kept in this browser only.`}
      </p>
      <Link to="/account" onClick={dismissNudge} className="text-xs font-bold text-brand-amber">{isArabic ? "احفظها في حساب مجاني ←" : "Save it to a free account →"}</Link>
    </Toast>
  );
};

const Toast: React.FC<React.PropsWithChildren<{ onClose: () => void; icon: React.ReactNode }>> = ({ onClose, icon, children }) => {
  const { isArabic } = useInterfaceLanguage();
  return (
    <div role="status" className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-6 sm:bottom-6 sm:w-96 z-40 rounded-2xl border border-brand-border bg-brand-surface p-4 shadow-xl flex gap-3">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 space-y-1 text-sm">{children}</div>
      <button type="button" onClick={onClose} aria-label={isArabic ? "إغلاق" : "Close"} className="self-start rounded-full p-1 text-brand-muted hover:text-brand-olive">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
