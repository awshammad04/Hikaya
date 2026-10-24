import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Award, BookHeart, BookOpen, Camera, CheckCircle2, Cloud, CloudOff, Headphones, Loader2, LogOut,
  MapPin, PenLine, Route, Sparkles, Stamp, Trash2, UserPlus,
} from "lucide-react";
import { PageTransition } from "../components/motion";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { AccountError, useAuth } from "../context/AuthContext";
import { useUserMemories } from "../hooks/useUserMemories";
import { useSavedStories } from "../hooks/useSavedStories";
import { governorates, governorateName, locationById, nationalRecord, scopedProfiles } from "../data/heritage";
import { JOURNEY_KEY } from "../services/journeys";
import {
  accountApi,
  AccountContribution,
  AUDIO_KEY,
  MEMORY_UNCOVERED_KEY,
  PROGRESS_EVENT,
  QUIZ_KEY,
  readIdList,
  SavedStory,
  VISITED_KEY,
} from "../services/accountSync";

function useProgress() {
  const read = () => ({
    visited: readIdList(VISITED_KEY),
    quiz: readIdList(QUIZ_KEY),
    audio: readIdList(AUDIO_KEY),
    memoryUncovered: readIdList(MEMORY_UNCOVERED_KEY),
  });
  const [progress, setProgress] = useState(read);
  useEffect(() => {
    const update = () => setProgress(read());
    window.addEventListener(PROGRESS_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return progress;
}

const STATUS_STYLE: Record<AccountContribution["status"], string> = {
  pending_review: "bg-amber-50 text-amber-800 border-amber-200",
  approved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-red-50 text-red-800 border-red-200",
};

/**
 * "My passport": the visitor's journey through the archive. A guest sees the
 * same page for the journey kept on this device, with a nudge to save it.
 */
export const PassportPage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { status, user, guest, syncing, logOut, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const progress = useProgress();
  const { memories, removeMemory } = useUserMemories();
  const { stories, deleteStory } = useSavedStories();
  const [contributions, setContributions] = useState<AccountContribution[] | null>(null);
  const [openStory, setOpenStory] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const signedIn = status === "signed-in";

  useEffect(() => {
    if (!signedIn) {
      setContributions(null);
      return;
    }
    accountApi.contributions().then(setContributions).catch(() => setContributions([]));
  }, [signedIn]);

  const places = useMemo(() => scopedProfiles("all").map((place) => ({
    ...place,
    governorateId: nationalRecord(place.id)?.governorateId ?? "jerusalem",
  })), []);
  const visited = new Set(progress.visited);
  const visitedPlaces = places.filter((place) => visited.has(place.id));
  const governoratesReached = new Set(visitedPlaces.map((place) => place.governorateId));

  const achievements = [
    { id: "first", icon: MapPin, earned: visitedPlaces.length >= 1, ar: "الخطوة الأولى", en: "First step", arHint: "افتح أول مكان", enHint: "Open your first place" },
    { id: "storyteller", icon: BookOpen, earned: visitedPlaces.length >= 3, ar: "حكواتي", en: "Storyteller", arHint: "ثلاثة أماكن", enHint: "Three places" },
    { id: "listener", icon: Headphones, earned: progress.audio.length >= 3, ar: "أذن صاغية", en: "Good listener", arHint: "استمع إلى ثلاث حكايات", enHint: "Listen to three stories" },
    { id: "quiz", icon: Sparkles, earned: progress.quiz.length >= 3, ar: "ذاكرة حاضرة", en: "Sharp memory", arHint: "أكمل ثلاثة اختبارات", enHint: "Finish three quizzes" },
    { id: "photo", icon: Camera, earned: memories.length >= 1, ar: "عين الرحّالة", en: "Traveler's eye", arHint: "أضف صورة إلى ألبومك", enHint: "Add a photo to your album" },
    { id: "four", icon: Route, earned: governorates.every((item) => governoratesReached.has(item.id)), ar: "من القدس إلى غزة", en: "Jerusalem to Gaza", arHint: "مكان في كل محافظة", enHint: "A place in every governorate" },
    { id: "keeper", icon: Award, earned: places.length > 0 && visitedPlaces.length === places.length, ar: "حارس الحكاية", en: "Keeper of the story", arHint: "كل الأماكن", enHint: "Every place" },
  ];

  const stats = [
    { icon: Stamp, value: visitedPlaces.length, ar: "أختام", en: "Stamps" },
    { icon: Sparkles, value: progress.quiz.length, ar: "اختبارات", en: "Quizzes" },
    { icon: Headphones, value: progress.audio.length, ar: "حكايات مسموعة", en: "Narrations" },
    { icon: Camera, value: memories.length, ar: "صور", en: "Photos" },
    { icon: BookHeart, value: stories.length, ar: "حكايات محفوظة", en: "Saved stories" },
  ];

  const openJourney = (story: SavedStory) => {
    try {
      window.localStorage.setItem(JOURNEY_KEY, JSON.stringify(story.payload));
      navigate("/my-story");
    } catch {
      setOpenStory(story.id);
    }
  };

  const confirmDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    setDeleteError(null);
    try {
      await deleteAccount(deletePassword);
      navigate("/", { replace: true });
    } catch (caught) {
      setDeleteError(caught instanceof AccountError && caught.status === 401
        ? (isArabic ? "كلمة المرور غير صحيحة." : "The password is incorrect.")
        : (isArabic ? "تعذّر حذف الحساب الآن." : "The account could not be deleted right now."));
    }
  };

  const displayName = signedIn && user ? user.fullName : (isArabic ? guest.ar : guest.en);
  const since = new Date(signedIn && user ? user.createdAt : guest.since)
    .toLocaleDateString(isArabic ? "ar" : "en", { year: "numeric", month: "long" });

  if (status === "loading") {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-brand-olive" /></div>;
  }

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* --- Passport cover ---------------------------------------------- */}
        <header className="relative overflow-hidden rounded-3xl bg-brand-olive text-white p-6 sm:p-8">
          <div aria-hidden="true" className="absolute -top-16 -end-16 h-56 w-56 rounded-full border-[18px] border-brand-amber/20" />
          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-[0.3em] text-brand-amber">
                {isArabic ? "جواز سفر حكاية" : "Hikaya passport"}
                {!signedIn && ` · ${isArabic ? "ضيف" : "guest"}`}
              </p>
              <h1 className="font-serif font-black text-3xl sm:text-4xl">
                {displayName}
                {!signedIn && <span className="text-brand-amber font-mono text-lg ms-2">#{guest.number}</span>}
              </h1>
              <p className="text-sm text-white/75">
                {signedIn
                  ? (isArabic ? `عضو منذ ${since}` : `Member since ${since}`)
                  : (isArabic ? `على هذا الجهاز منذ ${since}` : `On this device since ${since}`)}
              </p>
            </div>
            <p className="inline-flex items-center gap-2 self-start sm:self-auto rounded-full bg-white/10 px-4 py-2 text-xs">
              {signedIn
                ? syncing
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{isArabic ? "جارٍ المزامنة…" : "Syncing…"}</>
                  : <><Cloud className="w-3.5 h-3.5 text-brand-amber" />{isArabic ? "محفوظ في حسابك" : "Saved to your account"}</>
                : <><CloudOff className="w-3.5 h-3.5 text-brand-amber" />{isArabic ? "محفوظ على هذا الجهاز فقط" : "Saved on this device only"}</>}
            </p>
          </div>
          <dl className="relative mt-8 grid grid-cols-2 sm:grid-cols-5 gap-3">
            {stats.map(({ icon: Icon, value, ar, en }) => (
              <div key={en} className="rounded-2xl bg-white/10 px-4 py-3">
                <dt className="text-xs text-white/70 inline-flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{isArabic ? ar : en}</dt>
                <dd className="font-serif font-black text-2xl mt-1">{value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {!signedIn && (
          <section className="rounded-3xl border-2 border-dashed border-brand-amber/50 bg-brand-amber/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-serif font-black text-xl text-brand-olive">{isArabic ? "لا تدع رحلتك تضيع" : "Don't lose your journey"}</h2>
              <p className="text-sm text-brand-text leading-relaxed">
                {isArabic
                  ? "إن مسحت بيانات المتصفح أو غيّرت الجهاز فستختفي أختامك وصورك. أنشئ حساباً وستنتقل إليه كلها كما هي."
                  : "Clear this browser or switch devices and your stamps and photos are gone. Create an account and all of it moves in, exactly as it is."}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link to="/account" className="rounded-full bg-brand-amber px-5 py-2.5 text-xs font-bold text-white inline-flex items-center gap-1.5"><UserPlus className="w-4 h-4" />{isArabic ? "احفظ رحلتي" : "Save my journey"}</Link>
              <Link to="/account?mode=login" className="rounded-full border border-brand-border bg-brand-surface px-5 py-2.5 text-xs font-bold text-brand-olive">{isArabic ? "لدي حساب" : "I have an account"}</Link>
            </div>
          </section>
        )}

        {/* --- Stamps -------------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="font-serif font-black text-2xl text-brand-olive">{isArabic ? "أختام الأماكن" : "Place stamps"}</h2>
          {governorates.map((item) => {
            const inGovernorate = places.filter((place) => place.governorateId === item.id);
            if (!inGovernorate.length) return null;
            const count = inGovernorate.filter((place) => visited.has(place.id)).length;
            return (
              <div key={item.id} className="rounded-3xl border border-brand-border bg-brand-surface p-5 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <Link to={`/governorates/${item.id}`} className="font-serif font-bold text-brand-olive hover:text-brand-amber">{governorateName(item.id, isArabic)}</Link>
                  <span className="text-xs font-mono text-brand-muted">{count}/{inGovernorate.length}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                  {inGovernorate.map((place) => {
                    const stamped = visited.has(place.id);
                    return (
                      <Link
                        key={place.id}
                        to={`/locations/${place.id}`}
                        className={`group flex flex-col items-center justify-center text-center gap-1 rounded-full aspect-square p-2 sm:p-3 border-2 transition-transform hover:-rotate-3 ${stamped ? "border-brand-olive bg-brand-olive/5 text-brand-olive -rotate-6" : "border-dashed border-brand-border text-brand-muted"}`}
                        title={isArabic ? place.arabicName : place.name}
                      >
                        {stamped ? <CheckCircle2 className="w-5 h-5 text-brand-amber" /> : <MapPin className="w-5 h-5" />}
                        <span className="text-xs font-bold leading-tight line-clamp-2">{isArabic ? place.arabicName : place.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* --- Achievements -------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="font-serif font-black text-2xl text-brand-olive">{isArabic ? "الأوسمة" : "Achievements"}</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {achievements.map(({ id, icon: Icon, earned, ar, en, arHint, enHint }) => (
              <li key={id} className={`rounded-2xl border p-4 text-center space-y-1.5 ${earned ? "border-brand-amber bg-brand-amber/10" : "border-brand-border bg-brand-surface opacity-60"}`}>
                <Icon className={`w-6 h-6 mx-auto ${earned ? "text-brand-amber" : "text-brand-muted"}`} />
                <p className="text-xs font-bold text-brand-olive">{isArabic ? ar : en}</p>
                <p className="text-xs text-brand-muted">{isArabic ? arHint : enHint}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* --- Album ---------------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="font-serif font-black text-2xl text-brand-olive">{isArabic ? "ألبوم رحلتي" : "My journey album"}</h2>
          {memories.length === 0 ? (
            <p className="text-sm text-brand-muted rounded-3xl border border-dashed border-brand-border p-6">
              {isArabic ? "أضف صورك من «إنشاء حكايتي» في أي محافظة، وستظهر هنا." : "Add photos from “My story” in any governorate and they will appear here."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {memories.map((memory) => (
                <li key={memory.id} className="group relative rounded-2xl bg-brand-surface border border-brand-border p-2 shadow-sm">
                  <img src={memory.photoDataUrl} alt={memory.locationTag} loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover bg-brand-border-light" />
                  <p className="mt-2 text-xs font-bold text-brand-olive">{memory.locationTag}</p>
                  <p className="text-xs text-brand-muted line-clamp-2">{memory.note}</p>
                  <button
                    type="button"
                    onClick={() => removeMemory(memory.id)}
                    aria-label={isArabic ? "حذف الصورة" : "Delete photo"}
                    className="absolute top-3 end-3 rounded-full bg-brand-surface/90 p-1.5 text-red-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --- Saved stories --------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="font-serif font-black text-2xl text-brand-olive">{isArabic ? "حكاياتي المحفوظة" : "My saved stories"}</h2>
          {stories.length === 0 ? (
            <p className="text-sm text-brand-muted rounded-3xl border border-dashed border-brand-border p-6">
              {isArabic ? "رحلات «حكايتي في فلسطين» تُحفظ هنا تلقائياً، ويمكنك حفظ أي حكاية مولّدة من صفحة المكان." : "Journeys from “My Palestine story” are kept here automatically, and you can save any generated story from a place page."}
              {" "}<Link to="/create-story" className="font-bold text-brand-amber">{isArabic ? "أنشئ رحلة" : "Create a journey"}</Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {stories.map((story) => {
                const narrative = (story.payload as { narrative?: string } | null)?.narrative;
                const place = story.locationId ? locationById(story.locationId) : undefined;
                return (
                  <li key={story.id} className="rounded-2xl border border-brand-border bg-brand-surface p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-serif font-bold text-brand-olive">{story.title}</p>
                        <p className="text-xs text-brand-muted">
                          {story.kind === "journey"
                            ? story.governorateIds.map((id) => governorateName(id, isArabic)).join(" · ")
                            : place ? (isArabic ? place.arabicName : place.name) : story.locationId}
                          {" · "}{new Date(story.createdAt).toLocaleDateString(isArabic ? "ar" : "en")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {story.kind === "journey" ? (
                          <button type="button" onClick={() => openJourney(story)} className="rounded-full bg-brand-olive px-4 py-1.5 text-xs font-bold text-white">{isArabic ? "افتح الرحلة" : "Open journey"}</button>
                        ) : (
                          <button type="button" onClick={() => setOpenStory(openStory === story.id ? null : story.id)} className="rounded-full bg-brand-olive px-4 py-1.5 text-xs font-bold text-white">{openStory === story.id ? (isArabic ? "إخفاء" : "Hide") : (isArabic ? "اقرأ" : "Read")}</button>
                        )}
                        <button type="button" onClick={() => deleteStory(story.id)} aria-label={isArabic ? "حذف الحكاية" : "Delete story"} className="rounded-full border border-brand-border p-1.5 text-red-700"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {openStory === story.id && narrative && (
                      <div className="text-sm text-brand-text leading-loose whitespace-pre-line border-t border-brand-border-light pt-3">
                        {narrative}
                        {story.locationId && <Link to={`/locations/${story.locationId}`} className="block mt-3 text-xs font-bold text-brand-amber">{isArabic ? "زر المكان ←" : "Visit the place →"}</Link>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* --- Contributions ---------------------------------------------------- */}
        <section className="space-y-4">
          <h2 className="font-serif font-black text-2xl text-brand-olive">{isArabic ? "ذكرياتي المشاركة" : "Memories I shared"}</h2>
          {!signedIn ? (
            <p className="text-sm text-brand-muted">
              {isArabic ? "كضيف، تابع ما شاركته عبر الرمز المرجعي في " : "As a guest, follow what you shared with its reference code on "}
              <Link to="/contribute" className="font-bold text-brand-amber">{isArabic ? "صفحة المشاركة" : "the contribute page"}</Link>.
            </p>
          ) : contributions === null ? (
            <Loader2 className="w-5 h-5 animate-spin text-brand-olive" />
          ) : contributions.length === 0 ? (
            <p className="text-sm text-brand-muted">
              {isArabic ? "لم تشارك ذكرى بعد. " : "You have not shared a memory yet. "}
              <Link to="/contribute" className="font-bold text-brand-amber inline-flex items-center gap-1"><PenLine className="w-3.5 h-3.5" />{isArabic ? "شارك حكاية" : "Share one"}</Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {contributions.map((item) => {
                const place = locationById(item.locationId);
                return (
                  <li key={item.id} className="rounded-2xl border border-brand-border bg-brand-surface px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-brand-olive">{item.title}</p>
                      <p className="text-xs text-brand-muted">{place ? (isArabic ? place.arabicName : place.name) : item.locationId} · {item.referenceCode}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLE[item.status]}`}>
                      {item.status === "approved" ? (isArabic ? "منشورة" : "Published") : item.status === "rejected" ? (isArabic ? "لم تُنشر" : "Not published") : (isArabic ? "قيد المراجعة" : "In review")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* --- Account ------------------------------------------------------------ */}
        {signedIn && user && (
          <section className="rounded-3xl border border-brand-border bg-brand-surface p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif font-black text-xl text-brand-olive">{isArabic ? "الحساب" : "Account"}</h2>
                <p className="text-sm text-brand-muted" dir="ltr">{user.email}</p>
              </div>
              <button type="button" onClick={() => void logOut().then(() => navigate("/"))} className="rounded-full border border-brand-border px-5 py-2 text-xs font-bold text-brand-olive inline-flex items-center gap-1.5">
                <LogOut className="w-4 h-4" />{isArabic ? "تسجيل الخروج" : "Sign out"}
              </button>
            </div>
            <p className="text-xs text-brand-muted">{isArabic ? "عند تسجيل الخروج تبقى رحلتك في حسابك وتُمسح من هذا الجهاز." : "Signing out keeps your journey in your account and clears it from this device."}</p>
            {!confirmingDelete ? (
              <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-bold text-red-700">{isArabic ? "حذف الحساب نهائياً" : "Delete account permanently"}</button>
            ) : (
              <form onSubmit={confirmDelete} className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-xs text-red-800">{isArabic ? "سيُحذف حسابك وأختامك وصورك وحكاياتك المحفوظة نهائياً. الذكريات التي شاركتها تبقى في الأرشيف دون ربطها بك." : "Your account, stamps, photos and saved stories will be deleted for good. Memories you shared stay in the archive, unlinked from you."}</p>
                <input type="password" dir="ltr" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder={isArabic ? "كلمة المرور للتأكيد" : "Password to confirm"} className="w-full rounded-xl border border-red-200 bg-brand-surface px-4 py-2 text-sm" autoComplete="current-password" />
                {deleteError && <p role="alert" className="text-xs text-red-800">{deleteError}</p>}
                <div className="flex gap-2">
                  <button type="submit" className="rounded-full bg-red-700 px-5 py-2 text-xs font-bold text-white">{isArabic ? "احذف حسابي" : "Delete my account"}</button>
                  <button type="button" onClick={() => { setConfirmingDelete(false); setDeletePassword(""); setDeleteError(null); }} className="rounded-full border border-brand-border bg-brand-surface px-5 py-2 text-xs font-bold text-brand-olive">{isArabic ? "إلغاء" : "Cancel"}</button>
                </div>
              </form>
            )}
          </section>
        )}
      </div>
    </PageTransition>
  );
};
