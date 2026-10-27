import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, EyeOff, Globe, Loader2, Lock, PenLine, Send, Trash2, UserRound, XCircle } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { locationById } from "../data/heritage";
import { getContributionStatus, submitContribution } from "../services/api";
import { MyStoryPayload, SavedStory, updateStory } from "../services/accountSync";
import type { ContributionStatus } from "../types";

const payloadOf = (story: SavedStory) => (story.payload ?? { content: "" }) as MyStoryPayload;

/**
 * "Stories I wrote" in the passport. Each story is private until its writer
 * shares it; a shared one shows where it is in review, read live from its
 * reference code so guests see the same thing as signed-in visitors.
 */
export const MyStoriesSection: React.FC<{ stories: SavedStory[]; onDelete: (id: string) => void }> = ({ stories, onDelete }) => {
  const { isArabic } = useInterfaceLanguage();
  const { user } = useAuth();
  const [statuses, setStatuses] = useState<Record<string, ContributionStatus>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [credit, setCredit] = useState<"named" | "anonymous" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codes = stories.map((story) => payloadOf(story).share?.referenceCode).filter((code): code is string => Boolean(code));
  const codesKey = codes.join(",");
  useEffect(() => {
    let cancelled = false;
    codes.forEach((code) => {
      getContributionStatus(code)
        .then((status) => { if (!cancelled) setStatuses((current) => ({ ...current, [code]: status })); })
        .catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [codesKey]);

  const startSharing = (id: string) => {
    setSharingId(id);
    setCredit(null);
    setName(user?.fullName ?? "");
    setEmail("");
    setError(null);
  };

  const share = async (story: SavedStory) => {
    const payload = payloadOf(story);
    const creditedAs = credit === "named" ? name.trim() || null : null;
    if (!story.locationId || !credit || (credit === "named" && !creditedAs)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await submitContribution({
        locationId: story.locationId,
        title: story.title,
        content: payload.content,
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        contributorName: creditedAs ?? undefined,
        contributorEmail: creditedAs ? email.trim() || undefined : undefined,
      });
      await updateStory({
        ...story,
        payload: {
          ...payload,
          share: {
            referenceCode: response.referenceCode,
            contributionId: response.contribution.id,
            creditedAs,
            sharedAt: new Date().toISOString(),
          },
        },
      });
      setSharingId(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : isArabic ? "تعذر إرسال الحكاية." : "The story could not be sent.");
    } finally {
      setBusy(false);
    }
  };

  const badge = (story: SavedStory) => {
    const code = payloadOf(story).share?.referenceCode;
    if (!payloadOf(story).share) return { icon: Lock, style: "bg-brand-bg text-brand-muted border-brand-border", label: isArabic ? "خاصة" : "Private" };
    const status = code ? statuses[code]?.status : undefined;
    if (status === "approved") return { icon: CheckCircle2, style: "bg-emerald-50 text-emerald-800 border-emerald-200", label: isArabic ? "منشورة للجميع" : "Public" };
    if (status === "rejected") return { icon: XCircle, style: "bg-red-50 text-red-800 border-red-200", label: isArabic ? "لم تُعتمد" : "Not approved" };
    return { icon: Clock, style: "bg-amber-50 text-amber-800 border-amber-200", label: isArabic ? "قيد المراجعة" : "In review" };
  };

  const choice = (active: boolean) =>
    `flex-1 min-w-[10rem] rounded-xl border px-3 py-2 text-start text-xs inline-flex items-center gap-2 ${active ? "border-brand-amber bg-brand-amber/10 ring-2 ring-brand-amber font-bold text-brand-olive" : "border-brand-border text-brand-text hover:border-brand-amber"}`;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-serif font-black text-2xl text-brand-olive">{isArabic ? "ذكريات كتبتها" : "Memories I wrote"}</h2>
        <Link to="/contribute" className="text-xs font-bold text-brand-amber inline-flex items-center gap-1"><PenLine className="w-3.5 h-3.5" />{isArabic ? "شارك ذكرى" : "Share a memory"}</Link>
      </div>
      {stories.length === 0 ? (
        <p className="text-sm text-brand-muted rounded-3xl border border-dashed border-brand-border p-6">
          {isArabic ? "اكتب ذكراك عن أي مكان؛ تبقى هنا لك وحدك، أو تشاركها مع الجميع بعد مراجعة المشرف." : "Write your memory of any place. It stays here just for you, or you can share it with everyone after an admin reviews it."}
        </p>
      ) : (
        <ul className="space-y-3">
          {stories.map((story) => {
            const payload = payloadOf(story);
            const place = story.locationId ? locationById(story.locationId) : undefined;
            const code = payload.share?.referenceCode;
            const status = code ? statuses[code] : undefined;
            const { icon: BadgeIcon, style, label } = badge(story);
            return (
              <li key={story.id} className="rounded-2xl border border-brand-border bg-brand-surface p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-serif font-bold text-brand-olive">{story.title}</p>
                    <p className="text-xs text-brand-muted">
                      {place ? (isArabic ? place.arabicName : place.name) : story.locationId}
                      {" · "}{new Date(story.createdAt).toLocaleDateString(isArabic ? "ar" : "en")}
                      {code && <> · <span dir="ltr">{code}</span></>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold inline-flex items-center gap-1 ${style}`}>
                      <BadgeIcon className="w-3.5 h-3.5" />{label}
                    </span>
                    <button type="button" onClick={() => setOpenId(openId === story.id ? null : story.id)} className="rounded-full bg-brand-olive px-4 py-1.5 text-xs font-bold text-white">
                      {openId === story.id ? (isArabic ? "إخفاء" : "Hide") : (isArabic ? "اقرأ" : "Read")}
                    </button>
                    {!payload.share && sharingId !== story.id && (
                      <button type="button" onClick={() => startSharing(story.id)} className="rounded-full border border-brand-olive px-4 py-1.5 text-xs font-bold text-brand-olive inline-flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />{isArabic ? "اجعلها عامة" : "Make public"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(story.id)}
                      aria-label={isArabic ? "حذف الحكاية" : "Delete story"}
                      title={payload.share ? (isArabic ? "يحذف نسختك فقط؛ النسخة المنشورة تبقى" : "Removes your copy only; a published copy stays") : undefined}
                      className="rounded-full border border-brand-border p-1.5 text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {status?.status === "rejected" && status.reviewNotes && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    <span className="font-bold">{isArabic ? "ملاحظة المشرف: " : "Reviewer note: "}</span>{status.reviewNotes}
                  </p>
                )}
                {status?.status === "approved" && story.locationId && (
                  <Link to={`/locations/${story.locationId}?tab=memories`} className="text-xs font-bold text-brand-amber">
                    {isArabic ? "شاهدها في صفحة المكان ←" : "See it on the place page →"}
                  </Link>
                )}

                {openId === story.id && (
                  <div className="space-y-2 border-t border-brand-border-light pt-3">
                    <p className="text-sm text-brand-text leading-loose whitespace-pre-line">{payload.content}</p>
                    {payload.mediaUrl && (
                      <a href={payload.mediaUrl} target="_blank" rel="noreferrer" className="block text-xs font-bold text-brand-amber break-all">{payload.mediaUrl}</a>
                    )}
                    {payload.share && (
                      <p className="text-xs text-brand-muted inline-flex items-center gap-1.5">
                        {payload.share.creditedAs ? <UserRound className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {payload.share.creditedAs
                          ? (isArabic ? `شاركتها باسم: ${payload.share.creditedAs}` : `Shared as: ${payload.share.creditedAs}`)
                          : (isArabic ? "شاركت الحكاية فقط، دون اسم." : "Shared without a name — only the story.")}
                      </p>
                    )}
                  </div>
                )}

                {sharingId === story.id && (
                  <div className="space-y-3 rounded-2xl border border-brand-border bg-brand-bg p-4">
                    <p className="text-sm font-bold text-brand-olive">{isArabic ? "ماذا نشارك مع الحكاية؟" : "What should we share with the story?"}</p>
                    <div role="radiogroup" aria-label={isArabic ? "ما يُنشر مع الحكاية" : "What is published with the story"} className="flex flex-wrap gap-2">
                      <button type="button" role="radio" aria-checked={credit === "named"} onClick={() => setCredit("named")} className={choice(credit === "named")}>
                        <UserRound className="w-4 h-4 text-brand-amber" />{isArabic ? "الحكاية واسمي" : "The story and my name"}
                      </button>
                      <button type="button" role="radio" aria-checked={credit === "anonymous"} onClick={() => setCredit("anonymous")} className={choice(credit === "anonymous")}>
                        <EyeOff className="w-4 h-4 text-brand-amber" />{isArabic ? "الحكاية فقط" : "Only the story"}
                      </button>
                    </div>
                    {credit === "named" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} aria-label={isArabic ? "الاسم الظاهر" : "Name to show"} placeholder={isArabic ? "الاسم الظاهر" : "Name to show"} className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-sm" />
                        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-label={isArabic ? "البريد الإلكتروني (اختياري)" : "Email (optional)"} placeholder={isArabic ? "البريد (اختياري، لا يُنشر)" : "Email (optional, never published)"} className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-sm" />
                      </div>
                    )}
                    <p className="text-xs text-brand-muted">
                      {isArabic ? "يراجعها مشرف أولاً، ثم تظهر في صفحة المكان لكل الزوار." : "An admin reviews it first; then it appears on the place page for every visitor."}
                    </p>
                    {error && <p role="alert" className="text-xs text-red-800">{error}</p>}
                    <div className="flex gap-2">
                      <button type="button" disabled={busy || !credit || (credit === "named" && !name.trim())} onClick={() => void share(story)} className="rounded-full bg-brand-olive px-5 py-2 text-xs font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-brand-amber" />}
                        {isArabic ? "أرسلها للمراجعة" : "Send for review"}
                      </button>
                      <button type="button" onClick={() => setSharingId(null)} className="rounded-full border border-brand-border bg-brand-surface px-5 py-2 text-xs font-bold text-brand-olive">{isArabic ? "إلغاء" : "Cancel"}</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
