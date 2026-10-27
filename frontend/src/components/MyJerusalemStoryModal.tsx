import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Camera,
  Download,
  Footprints,
  ImagePlus,
  MapPin,
  MessageSquareText,
  PenLine,
  Share2,
  Sparkles,
  X,
} from "lucide-react";
import { locations as jerusalemLocations } from "../locationsData";
import { scopedProfiles, governorateName, nationalRecord } from "../data/heritage";
import type { MyJerusalemStory, UserJourneyMemory } from "../types";
import {
  PROGRESS_EVENT,
  readAudioListened,
  readMemoriesUncovered,
  readQuizCompleted,
} from "../services/progress";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { prepareMemoryPhoto, useUserMemories } from "../hooks/useUserMemories";
import { photoAsDataUrl } from "../services/accountSync";

function readVisited(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem("hikaya.visited") ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function readTourProgress() {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem("hikaya-quds.itinerary") ?? "null");
    if (!value || typeof value !== "object") return { totalWalkingMinutes: 0 };
    const itinerary = value as { totalWalkingMinutes?: unknown };
    const totalWalkingMinutes = typeof itinerary.totalWalkingMinutes === "number" && Number.isFinite(itinerary.totalWalkingMinutes)
      ? Math.max(0, Math.round(itinerary.totalWalkingMinutes))
      : 0;
    return { totalWalkingMinutes };
  } catch {
    return { totalWalkingMinutes: 0 };
  }
}

function buildStory(isArabic: boolean, memories: UserJourneyMemory[], locations = jerusalemLocations, scope = "jerusalem"): MyJerusalemStory {
  const exploredLocationIds = readVisited().filter((id) => locations.some((location) => location.id === id));
  const tour = readTourProgress();
  const completedQuizLocationIds = readQuizCompleted().filter((id) => locations.some((location) => location.id === id));
  const listenedLocationIds = readAudioListened().filter((id) => locations.some((location) => location.id === id));
  const heritageSitesDiscovered = new Set([...exploredLocationIds, ...completedQuizLocationIds, ...listenedLocationIds])
    .size;
  const count = exploredLocationIds.length;
  const story: MyJerusalemStory = {
    generatedAt: new Date().toISOString(),
    exploredLocationIds,
    completedQuizLocationIds,
    listenedLocationIds,
    oralMemoriesUncovered: readMemoriesUncovered().length,
    totalWalkingMinutes: tour.totalWalkingMinutes,
    heritageSitesDiscovered,
    personalPhotosCaptured: memories.filter((memory) => memory.photoDataUrl).length,
    personalMemoriesWritten: memories.filter((memory) => memory.note.trim()).length,
    badge: isArabic
      ? count >= locations.length && completedQuizLocationIds.length >= 4 ? "حارس حكاية" : count >= 3 ? "راوي القدس" : "خطوة في القدس"
      : count >= locations.length && completedQuizLocationIds.length >= 4 ? "Guardian of Jerusalem’s Story" : count >= 3 ? "Jerusalem Storyteller" : "A Step into Jerusalem",
    reflection: isArabic
      ? count === 0 ? "كل حكاية تبدأ من باب؛ اختر أول حي لتبدأ حكايتك." : count >= locations.length ? "عبرت أبواب القدس وحاراتها؛ صارت الخريطة ذاكرةً تمشي معك." : `استكشفت ${count} من حارات القدس؛ وكل موقع حفظته يفتح طريقاً جديداً للحكاية.`
      : count === 0 ? "Every story begins at a gate; choose your first neighbourhood to begin." : count >= locations.length ? "You crossed Jerusalem’s gates and quarters; the map has become a memory you carry." : `You explored ${count} Jerusalem places; every site remembered opens another path into the story.`,
  };
  return scope === 'jerusalem' ? story : {...story,oralMemoriesUncovered:0,totalWalkingMinutes:0,
    badge:isArabic?'راوي حكاية':'Hikaya storyteller',
    reflection:isArabic?`استكشفت ${count} أماكن من أرشيف ${scope === 'all'?'فلسطين':governorateName(scope,true)}. تحمل هذه الحكاية تقدّمك وذكرياتك الشخصية.`:`You explored ${count} places in the ${scope === 'all'?'Palestine':governorateName(scope,false)} archive. This story carries your progress and personal memories.`};
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] as string);
}

const EXTRA_LOCATION_SUGGESTIONS = [
  { ar: "سوق خان الزيت", en: "Khan al-Zeit Market" },
  { ar: "سوق القطانين", en: "Souq al-Qattanin" },
  { ar: "طريق الآلام", en: "Via Dolorosa" },
  { ar: "الجثمانية", en: "Gethsemane" },
];

const DEFAULT_MEMORIES = [
  {
    photo: "/images/jerusalem/gallery/bab-khan-zait-2019.jpg",
    locationAr: "سوق خان الزيت",
    locationEn: "Khan al-Zeit Market",
    noteAr: "وقفت عند الدكان أراقب الناس وهم يمرّون. ابتسم صاحب المحل حين التقطت الصورة، وبقيت رائحة القهوة والزعتر في الطريق.",
    noteEn: "I stopped by the shop to watch people pass. The owner smiled when I took this photo, and the scent of coffee and za'atar followed me down the street.",
    createdAt: "2026-04-18T09:40:00+03:00",
  },
  {
    photo: "/images/jerusalem/artisans/jerusalem-kaak-baker-2012.jpg",
    locationAr: "قرب باب العامود",
    locationEn: "Near Damascus Gate",
    noteAr: "اشترينا كعكاً ساخناً قبل أن نكمل المشي. ما زلت أتذكر قرمشة السمسم وصوت البائع وهو ينادي.",
    noteEn: "We bought warm ka'ak before continuing our walk. I still remember the sesame crunch and the vendor calling out.",
    createdAt: "2026-04-18T11:15:00+03:00",
  },
];

export const MyJerusalemStoryModal: React.FC<{ open: boolean; onClose: () => void; scope?: string; locationIds?: string[] }> = ({ open, onClose, scope = "jerusalem", locationIds }) => {
  const locations = scopedProfiles(scope).filter((item) => !locationIds || locationIds.includes(item.id));
  const { isArabic } = useInterfaceLanguage();
  const { memories, addMemory } = useUserMemories();
  const [, refresh] = useState(0);
  const [addingMemory, setAddingMemory] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [locationTag, setLocationTag] = useState("");
  const [note, setNote] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => refresh((value) => value + 1);
    window.addEventListener(PROGRESS_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setAddingMemory(false);
      setMemoryError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    modalScrollRef.current?.scrollTo({ top: 0 });
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [open]);

  const defaultMemories = useMemo<UserJourneyMemory[]>(() => (scope === "jerusalem" ? DEFAULT_MEMORIES : []).map((memory, index) => ({
    id: `jerusalem-memory-${index + 1}`,
    photoDataUrl: memory.photo,
    locationTag: isArabic ? memory.locationAr : memory.locationEn,
    note: isArabic ? memory.noteAr : memory.noteEn,
    createdAt: memory.createdAt,
  })), [isArabic,scope]);
  const includedGovernorates = [...new Set(locations.map((item)=>nationalRecord(item.id)?.governorateId ?? 'jerusalem'))];
  const displayedMemories = [...memories.filter((item) => scope === "all"
    ? (item.governorateId === 'all' ? item.governorateIds?.some((id)=>includedGovernorates.includes(id)) : includedGovernorates.includes(item.governorateId ?? 'jerusalem'))
    : (item.governorateId ?? "jerusalem") === scope), ...defaultMemories];
  const story = buildStory(isArabic, displayedMemories, locations, scope);
  const scopeName = scope === "all" ? (isArabic ? "فلسطين" : "Palestine") : governorateName(scope,isArabic);
  const storyTitle = isArabic ? `ألبوم رحلتي في ${scopeName}` : `My ${scopeName} trip album`;
  const albumTitle = isArabic ? `ألبوم ذكرياتي ولحظاتي في ${scopeName}` : `My ${scopeName} Journey Memories`;
  const explored = locations.filter((location) => story.exploredLocationIds.includes(location.id));
  const exploredNames = explored.map((item) => isArabic ? item.arabicName : item.name);
  const locationSuggestions = useMemo(() => [
    ...locations.map((location) => isArabic ? location.arabicName : location.name),
    ...(scope === "jerusalem" ? EXTRA_LOCATION_SUGGESTIONS : []).map((location) => isArabic ? location.ar : location.en),
  ], [isArabic,scope]);

  if (!open) return null;

  const resetMemoryDraft = () => {
    setPhotoDataUrl("");
    setLocationTag("");
    setNote("");
    setMemoryError(null);
    setAddingMemory(false);
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setMemoryError(null);
    try {
      setPhotoDataUrl(await prepareMemoryPhoto(file));
    } catch {
      setMemoryError(isArabic
        ? "تعذر تجهيز الصورة. اختر صورة JPG أو PNG أخرى."
        : "That photo could not be prepared. Try another JPG or PNG image.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveMemory = () => {
    if (!photoDataUrl || !locationTag.trim() || !note.trim()) return;
    try {
      addMemory({
        photoDataUrl,
        governorateId: scope,
        governorateIds: scope === 'all' ? includedGovernorates : undefined,
        locationTag: locationTag.trim(),
        note: note.trim(),
      });
      resetMemoryDraft();
    } catch {
      setMemoryError(isArabic
        ? "امتلأت مساحة الحفظ على هذا الجهاز. جرّب صورة أصغر."
        : "This device’s local album is full. Try a smaller photo.");
    }
  };

  const share = async () => {
    const title = storyTitle;
    const memoryLine = isArabic
      ? `${story.personalPhotosCaptured} صور · ${story.personalMemoriesWritten} ذكريات شخصية`
      : `${story.personalPhotosCaptured} photos · ${story.personalMemoriesWritten} personal memories`;
    const text = `${title} — ${story.badge}\n${story.reflection}\n${memoryLine}\n${exploredNames.join(isArabic ? "، " : ", ")}`;
    if (navigator.share) await navigator.share({ title, text }).catch(() => undefined);
    else await navigator.clipboard?.writeText(text);
  };

  const download = async () => {
    const lang = isArabic ? "ar" : "en";
    // Synced photos are account URLs; embed every image so the file works offline.
    const photoSources = await Promise.all(displayedMemories.map((memory) => photoAsDataUrl(memory.photoDataUrl)));
    const title = storyTitle;
    const exploredLabel = isArabic ? "الحارات التي استكشفتها" : "Places explored";
    const memoriesLabel = albumTitle;
    const empty = isArabic ? "ستبدأ قريباً" : "Your journey will begin soon";
    const stats = isArabic
      ? `مواقع مكتشفة: ${story.heritageSitesDiscovered}${scope === 'jerusalem' ? ` · مشي مخطط: ${story.totalWalkingMinutes} دقيقة` : ''} · صور ملتقطة: ${story.personalPhotosCaptured} · ذكريات مدونة: ${story.personalMemoriesWritten}`
      : `Heritage sites discovered: ${story.heritageSitesDiscovered}${scope === 'jerusalem' ? ` · Planned walking: ${story.totalWalkingMinutes} min` : ''} · Photos captured: ${story.personalPhotosCaptured} · Memories written: ${story.personalMemoriesWritten}`;
    const album = displayedMemories.length > 0
      ? displayedMemories.map((memory, index) => `<figure><img src="${photoSources[index]}" alt=""><figcaption><b>${escapeHtml(memory.locationTag)}</b><p>${escapeHtml(memory.note)}</p></figcaption></figure>`).join("")
      : `<p>${empty}</p>`;
    const html = `<!doctype html><html lang="${lang}" dir="${isArabic ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>@font-face{font-family:Thmanyah;src:url('/fonts/thmanyah-sans-regular.woff2')}*{box-sizing:border-box}body{font-family:Thmanyah,serif;background:#f5f5f0;color:#2d2d2a;padding:24px}.card{max-width:820px;margin:auto;border:2px solid #d97706;border-radius:28px;padding:32px;background:white}h1,h2{color:#5a5a40}small{color:#8a8a80}.album{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:18px}figure{margin:0;padding:9px 9px 18px;background:#fff;border:1px solid #ddd8ca;box-shadow:0 10px 24px #352f2022}figure img{width:100%;aspect-ratio:4/3;object-fit:cover}figcaption{padding:10px 4px 0}figcaption p{white-space:pre-wrap}.outro{margin-top:28px;padding:38px 24px;border-radius:22px;color:white;background:linear-gradient(120deg,#3f412dcc,#16170dcc),${scope === 'jerusalem' ? "url('/images/jerusalem/at-tur.jpg') center/cover" : '#5a5a40'}}.outro h2{color:white}</style><div class="card"><small>Hikaya</small><h1>${title}</h1><h2>${escapeHtml(story.badge)}</h2><p>${escapeHtml(story.reflection)}</p><h3>${exploredLabel}</h3><p>${exploredNames.map(escapeHtml).join(" · ") || empty}</p><p>${stats}</p><h3>${memoriesLabel}</h3><div class="album">${album}</div><div class="outro"><small>${scope === "jerusalem" ? (isArabic ? "المشهد الختامي · جبل الزيتون" : "FINAL SCENE · MOUNT OF OLIVES") : scopeName}</small><h2>${isArabic ? "تنتهي الجولة، وتبدأ حكايتك" : "The tour ends. Your story begins."}</h2><p>${scope === "jerusalem" ? (isArabic ? "القدس ليست مكاناً نزوره فقط؛ إنها حكاية نحملها معنا." : "Jerusalem is not only a place we visit; it is a story we carry with us.") : escapeHtml(story.reflection)}</p></div></div></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "Hikaya-story.html";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/70 p-3 backdrop-blur-md sm:items-center sm:p-8" role="dialog" aria-modal="true" aria-label={storyTitle}>
      <div className="jerusalem-story-dialog flex w-full max-w-2xl min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-brand-amber/80 bg-brand-surface shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:rounded-3xl" dir={isArabic ? "rtl" : "ltr"}>
        <header className="relative z-30 shrink-0 overflow-hidden bg-brand-olive px-5 py-4 text-white shadow-md sm:px-6 sm:py-5">
          <div className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_35%),radial-gradient(circle_at_80%_80%,#d97706_0,transparent_32%)]" />
          <div className="relative flex items-center gap-3">
            <span className="h-10 w-10 shrink-0 rounded-xl bg-brand-bg p-1">
              <img src="/logo-icon.png" alt="Hikaya" className="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-amber-light">{isArabic ? "تذكار جولتك الرقمية" : "Your digital tour keepsake"}</p>
              <h2 className="truncate font-serif text-2xl font-black sm:text-3xl">{storyTitle}</h2>
            </div>
            <button type="button" onClick={onClose} className="ms-auto shrink-0 rounded-full border border-white/25 bg-black/15 p-2 shadow-sm transition hover:bg-white/20" aria-label={isArabic ? "إغلاق" : "Close"}><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div ref={modalScrollRef} className="min-h-0 flex-1 touch-pan-y space-y-5 overflow-y-auto bg-brand-bg p-4 [-webkit-overflow-scrolling:touch] sm:p-6">
          <section className="relative overflow-hidden rounded-2xl border border-brand-border-light bg-brand-surface px-4 py-5 text-center shadow-[0_5px_20px_rgba(74,66,42,0.05)]">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-amber/60 to-transparent" />
            <Award className="mx-auto h-10 w-10 text-brand-amber" />
            <h3 className="font-serif text-2xl font-black text-brand-olive">{story.badge}</h3>
            <p className="mt-1 text-xs font-mono uppercase tracking-wider text-brand-muted">{isArabic ? "شهادة ختام جولتك" : "Your journey completion certificate"}</p>
            <p className="mt-2 text-sm text-brand-text">“{story.reflection}”</p>
          </section>

          <section className="rounded-2xl bg-brand-bg p-4">
            <p className="mb-2 text-xs text-brand-muted">{isArabic ? "الحارات التي استكشفتها" : "Places explored"} ({explored.length}/{locations.length})</p>
            <div className="flex flex-wrap gap-2">{explored.length ? explored.map((item) => <span key={item.id} className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs">{isArabic ? item.arabicName : item.name}</span>) : <span className="text-xs text-brand-muted">{isArabic ? "افتح صفحة حي ليُضاف إلى الحكاية." : "Open a place page to add it to your story."}</span>}</div>
          </section>

          <section className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
              <Stat value={story.heritageSitesDiscovered} label={isArabic ? "مواقع مكتشفة" : "Sites discovered"} icon={<MapPin className="h-3 w-3" />} />
              {scope === "jerusalem" && <Stat value={story.totalWalkingMinutes} label={isArabic ? "دقائق مشي" : "Walking min"} icon={<Footprints className="h-3 w-3" />} />}
              <Stat value={story.personalPhotosCaptured} label={isArabic ? "صور ملتقطة" : "Photos captured"} icon={<Camera className="h-3 w-3" />} />
              <Stat value={story.personalMemoriesWritten} label={isArabic ? "ذكريات مدونة" : "Memories written"} icon={<PenLine className="h-3 w-3" />} />
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-brand-muted">
              <MiniStat value={story.completedQuizLocationIds.length} label={isArabic ? "اختبارات" : "Quizzes"} />
              <MiniStat value={story.listenedLocationIds.length} label={isArabic ? "روايات مسموعة" : "Narrations"} />
              <MiniStat value={story.oralMemoriesUncovered} label={isArabic ? "ذكريات مكتشفة" : "Memories found"} icon={<MessageSquareText className="h-3 w-3" />} />
              <MiniStat value={explored.length} label={isArabic ? "حارات" : "Quarters"} />
            </div>
          </section>

          <section aria-labelledby="journey-memories-title" className="paper-scope space-y-3 rounded-3xl border border-brand-border-light bg-[linear-gradient(145deg,#f5efe2_0%,#fbfaf6_58%,#eee5d3_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-brand-border/60 pb-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-amber">{isArabic ? "من دفتر الطريق" : "From your travel journal"}</p>
                <h3 id="journey-memories-title" className="font-serif text-lg font-black leading-tight text-brand-olive sm:text-xl">{albumTitle}</h3>
                <p className="mt-1 text-xs text-brand-muted">{isArabic ? "صور وكلمات من تفاصيل الجولة." : "Photos and words from moments along the way."}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-brand-border bg-white/75 dark:bg-brand-surface px-2.5 py-1 text-xs font-bold text-brand-olive">{displayedMemories.length} {isArabic ? "ذكريات" : "memories"}</span>
                {!addingMemory && <button type="button" onClick={() => setAddingMemory(true)} className="rounded-full bg-brand-olive p-2 text-white shadow-sm transition hover:bg-brand-olive/90" aria-label={isArabic ? "أضف ذكرى" : "Add memory"}><ImagePlus className="h-4 w-4" /></button>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 px-1 pb-4 pt-3 sm:grid-cols-2">
              {displayedMemories.map((memory, index) => (
                  <figure key={memory.id} className="relative w-full rounded-sm bg-[#fffdf8] p-2 pb-4 shadow-[0_12px_28px_rgba(74,66,42,0.14)] ring-1 ring-[#d7cfbd]" style={{ transform: `rotate(${index % 2 === 0 ? -0.4 : 0.4}deg)` }}>
                    <span className="absolute start-1/2 top-0 z-10 h-5 w-16 -translate-x-1/2 -translate-y-1/2 rotate-[-2deg] bg-[#ddc797]/75 shadow-sm" />
                    <img src={memory.photoDataUrl} alt={memory.locationTag} className="aspect-[4/3] w-full rounded-[2px] bg-brand-border-light object-cover" />
                    <figcaption className="px-2 pt-3">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-amber"><MapPin className="h-3 w-3" />{memory.locationTag}</span>
                      <p className="mt-2 whitespace-pre-wrap font-serif text-[13px] leading-5 text-brand-text">{memory.note}</p>
                      <time className="mt-3 block border-t border-dashed border-brand-border pt-2 text-xs text-brand-muted" dateTime={memory.createdAt}>{new Intl.DateTimeFormat(isArabic ? "ar-PS" : "en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(memory.createdAt))}</time>
                    </figcaption>
                  </figure>
              ))}
            </div>

            {!addingMemory && (
              <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-dashed border-brand-amber/35 bg-white/65 dark:bg-brand-surface px-4 py-3 text-center sm:flex-row sm:text-start">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-amber/10 text-brand-amber"><Camera className="h-4 w-4" /></span>
                  <p className="max-w-sm text-xs leading-relaxed text-brand-text">{isArabic ? "أضف لقطة وكلماتك لتكبر الحكاية مع كل محطة." : "Add a photo and your own words as the story grows at every stop."}</p>
                </div>
                <button type="button" onClick={() => setAddingMemory(true)} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-olive px-4 py-2 text-xs font-bold text-white"><ImagePlus className="h-4 w-4 text-brand-amber-light" />{isArabic ? "أضف ذكرى" : "Add memory"}</button>
              </div>
            )}

            {addingMemory && (
              <div className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface p-4">
                <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                  <label className="flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-brand-amber/50 bg-brand-bg text-center text-xs text-brand-muted">
                    {photoDataUrl ? <img src={photoDataUrl} alt="" className="h-full w-full object-cover" /> : <span className="p-3"><Camera className="mx-auto mb-2 h-6 w-6 text-brand-amber" />{photoBusy ? (isArabic ? "جارٍ تجهيز الصورة…" : "Preparing photo…") : (isArabic ? "التقط صورة أو اخترها" : "Take or choose a photo")}</span>}
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
                  </label>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="memory-location" className="mb-1 block text-xs font-bold uppercase tracking-wider text-brand-muted">{isArabic ? "المكان" : "Location"}</label>
                      <input id="memory-location" list="jerusalem-memory-locations" value={locationTag} onChange={(event) => setLocationTag(event.target.value)} placeholder={isArabic ? "مثال: باب العامود" : "Example: Damascus Gate"} className="w-full rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm focus:border-brand-amber focus:outline-none" maxLength={100} />
                      <datalist id="jerusalem-memory-locations">{locationSuggestions.map((location) => <option key={location} value={location} />)}</datalist>
                    </div>
                    <div>
                      <label htmlFor="memory-note" className="mb-1 block text-xs font-bold uppercase tracking-wider text-brand-muted">{isArabic ? "ماذا تريد أن تتذكر؟" : "What do you want to remember?"}</label>
                      <textarea id="memory-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={isArabic ? "لحظة، صوت، رائحة، أو شعور من جولتك…" : "A moment, sound, scent, or feeling from your journey…"} className="min-h-24 w-full resize-y rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm focus:border-brand-amber focus:outline-none" maxLength={600} />
                    </div>
                  </div>
                </div>
                {memoryError && <p className="text-xs text-red-700" role="alert">{memoryError}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={resetMemoryDraft} className="rounded-full px-4 py-2 text-xs font-bold text-brand-muted">{isArabic ? "إلغاء" : "Cancel"}</button>
                  <button type="button" onClick={saveMemory} disabled={!photoDataUrl || !locationTag.trim() || !note.trim() || photoBusy} className="rounded-full bg-brand-olive px-5 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{isArabic ? "احفظها في ألبومي" : "Save to my album"}</button>
                </div>
              </div>
            )}
          </section>

          <section className="relative min-h-[210px] overflow-hidden rounded-3xl bg-brand-olive text-white shadow-lg" aria-label={scope === "jerusalem" ? (isArabic ? "المشهد الختامي من جبل الزيتون" : "Closing scene from the Mount of Olives") : storyTitle}>
            {scope === "jerusalem" && <img src="/images/jerusalem/at-tur.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-[#27291b] via-[#3f412dcc] to-[#3f412d55]" />
            <div className="relative flex min-h-[210px] flex-col justify-end p-5 sm:p-7">
              <span className="mb-auto inline-flex w-fit items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur"><Sparkles className="h-3 w-3 text-brand-amber" />{scope === "jerusalem" ? (isArabic ? "المشهد الختامي · جبل الزيتون" : "Final scene · Mount of Olives") : scopeName}</span>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-amber-light">{isArabic ? "حكاية" : "Hikaya"}</p>
              <h3 className="mt-1 font-serif text-2xl font-black sm:text-3xl">{isArabic ? "تنتهي الجولة، وتبدأ حكايتك" : "The tour ends. Your story begins."}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">{scope === "jerusalem" ? (isArabic ? "من مطلّة جبل الزيتون، تصبح القدس أكثر من مكان زرته؛ تصبح حكايةً تحملها معك." : "From the Mount of Olives, Jerusalem becomes more than a place you visited—it becomes a story you carry with you.") : story.reflection}</p>
            </div>
          </section>

          <p className="text-xs text-brand-muted">{isArabic ? "الشهادة مبنية على تقدّمك وصورك وكلماتك فقط؛ ولا تضيف أي ادعاء تاريخي." : "This certificate uses only your progress, photos, and words; it adds no historical claim."}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={download} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-olive py-3 text-xs font-bold text-white"><Download className="h-4 w-4" />{isArabic ? "تحميل الشهادة والألبوم" : "Download certificate and album"}</button>
            <button type="button" onClick={() => void share()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-brand-border py-3 text-xs font-bold"><Share2 className="h-4 w-4" />{isArabic ? "مشاركة حكاية الجولة" : "Share journey story"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ value: number; label: string; icon?: React.ReactNode }> = ({ value, label, icon }) => (
  <div className="rounded-2xl border border-brand-border-light bg-brand-surface p-2.5 shadow-[0_3px_12px_rgba(74,66,42,0.05)] sm:p-3">
    <strong className="block font-serif text-xl text-brand-olive sm:text-2xl">{value}</strong>
    <span className="mt-0.5 inline-flex items-center justify-center gap-1 text-brand-muted">{icon}{label}</span>
  </div>
);

const MiniStat: React.FC<{ value: number; label: string; icon?: React.ReactNode }> = ({ value, label, icon }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border-light bg-brand-surface px-3 py-1.5 shadow-sm">
    {icon}<strong className="text-brand-olive">{value}</strong>{label}
  </span>
);
