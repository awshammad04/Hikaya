import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3, Languages, Route, Sparkles } from "lucide-react";
import { useLocations } from "../hooks/useLocations";
import { locations as profileLocations } from "../locationsData";
import { GeneratedItinerary, TourDuration, TourInterest, TourLanguage, TourPreferences } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";

export const ITINERARY_KEY = "hikaya-quds.itinerary";

const LANGUAGES: { id: TourLanguage; label: string }[] = [
  { id: "ar", label: "العربية" }, { id: "en", label: "English" }, { id: "fr", label: "Français" },
];
const DURATIONS = [
  { id: "express" as TourDuration, ar: "سريعة · 1–2 ساعة", en: "Express · 1–2 hours", minutes: 110, count: 3 },
  { id: "half_day" as TourDuration, ar: "نصف يوم · 4 ساعات", en: "Half day · 4 hours", minutes: 240, count: 5 },
  { id: "full_day" as TourDuration, ar: "يوم كامل · 8 ساعات", en: "Full day · 8 hours", minutes: 480, count: 7 },
  { id: "weekend" as TourDuration, ar: "نهاية أسبوع معمّقة · يومان", en: "In-depth weekend · 2 days", minutes: 720, count: 8 },
];
const FRENCH_DURATION_LABELS: Record<TourDuration, string> = {
  express: "Express · 1–2 heures",
  half_day: "Demi-journée · 4 heures",
  full_day: "Journée complète · 8 heures",
  weekend: "Week-end approfondi · 2 jours",
};
const INTERESTS = [
  { id: "history" as TourInterest, ar: "تاريخ وحضارات", en: "History & civilizations" }, { id: "architecture" as TourInterest, ar: "عمارة القدس", en: "Jerusalem architecture" },
  { id: "religious" as TourInterest, ar: "مقدسات وأماكن عبادة", en: "Sacred sites & worship" }, { id: "food_markets" as TourInterest, ar: "أسواق ومأكولات مقدسية", en: "Souqs & Jerusalem food" },
  { id: "oral_heritage" as TourInterest, ar: "حكايات الناس والذاكرة الشفوية", en: "People’s stories & oral memory" },
];
const FRENCH_INTEREST_LABELS: Record<TourInterest, string> = {
  history: "Histoire et civilisations",
  architecture: "Architecture de Jérusalem",
  religious: "Lieux saints et de culte",
  food_markets: "Souks et cuisine de Jérusalem",
  oral_heritage: "Récits populaires et mémoire orale",
};
const INTEREST_PRIORITY: Record<TourInterest, string[]> = {
  history: ["maghariba-quarter", "bab-al-amud", "muslim-quarter", "christian-quarter", "armenian-quarter", "sheikh-jarrah", "silwan", "at-tur"],
  architecture: ["muslim-quarter", "christian-quarter", "armenian-quarter", "bab-al-amud", "sheikh-jarrah", "maghariba-quarter", "silwan", "at-tur"],
  religious: ["christian-quarter", "muslim-quarter", "at-tur", "armenian-quarter", "maghariba-quarter", "bab-al-amud"],
  food_markets: ["bab-al-amud", "muslim-quarter", "christian-quarter"],
  oral_heritage: ["silwan", "sheikh-jarrah", "maghariba-quarter", "bab-al-amud", "armenian-quarter", "muslim-quarter"],
};

export function isGeneratedItinerary(value: unknown): value is GeneratedItinerary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GeneratedItinerary>;
  if (!candidate.preferences || !Array.isArray(candidate.stops) || !Array.isArray(candidate.uncertaintyNotes)) return false;
  if (!["ar", "en", "fr"].includes(candidate.preferences.language)) return false;
  if (!["express", "half_day", "full_day", "weekend"].includes(candidate.preferences.duration)) return false;
  return candidate.stops.length > 0 && candidate.stops.every((stop) =>
    Boolean(stop)
    && typeof stop.locationId === "string"
    && typeof stop.latitude === "number"
    && Number.isFinite(stop.latitude)
    && typeof stop.longitude === "number"
    && Number.isFinite(stop.longitude),
  );
}

function distanceDetails(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const latKm = (a.latitude - b.latitude) * 111;
  const lngKm = (a.longitude - b.longitude) * 94;
  const distanceKm = Math.hypot(latKm, lngKm);
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const deltaLng = (b.longitude - a.longitude) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return { minutes: Math.max(3, Math.round((distanceKm / 4.5) * 60)), meters: Math.round(distanceKm * 1000 / 10) * 10, bearing: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360 };
}

function buildItinerary(preferences: TourPreferences, apiLocations: ReturnType<typeof useLocations>["locations"]): GeneratedItinerary {
  const duration = DURATIONS.find((item) => item.id === preferences.duration) ?? DURATIONS[0];
  const joined = apiLocations.map((location) => ({
    ...location,
    profile: profileLocations.find((item) => item.id === location.id),
  }));
  const scored = joined.sort((a, b) => {
    const score = (location: typeof a) => {
      const matches = location.profile?.interests.filter((interest) => preferences.interests.includes(interest)).length ?? 0;
      const priority = preferences.interests.reduce((sum, interest) => {
        const index = INTEREST_PRIORITY[interest].indexOf(location.id);
        return sum + (index < 0 ? 0 : (INTEREST_PRIORITY[interest].length - index) * 10);
      }, 0);
      return matches * 100 + priority;
    };
    const bScore = score(b);
    const aScore = score(a);
    return bScore - aScore || a.id.localeCompare(b.id);
  });
  const chosen = scored.slice(0, duration.count);
  // Greedy nearest-neighbour ordering reduces unnecessary backtracking while preserving the highest match as start.
  const ordered = chosen.length ? [chosen.shift()!] : [];
  while (chosen.length) {
    const last = ordered[ordered.length - 1];
    chosen.sort((a, b) => distanceDetails(last as Required<typeof last>, a as Required<typeof a>).minutes - distanceDetails(last as Required<typeof last>, b as Required<typeof b>).minutes || a.id.localeCompare(b.id));
    ordered.push(chosen.shift()!);
  }
  let walking = 0;
  const stopMinutes = Math.max(25, Math.floor((duration.minutes * 0.72) / Math.max(ordered.length, 1)));
  const stops = ordered.map((location, index) => {
    const previous = ordered[index - 1];
    const leg = previous && location.latitude != null && location.longitude != null && previous.latitude != null && previous.longitude != null
      ? distanceDetails(previous as Required<typeof previous>, location as Required<typeof location>)
      : { minutes: 0, meters: 0, bearing: undefined };
    const walk = leg.minutes;
    walking += walk;
    const matched = location.profile?.interests.filter((interest) => preferences.interests.includes(interest)) ?? [];
    const day = preferences.duration === "weekend" && index >= Math.ceil(ordered.length / 2) ? 2 : 1;
    return {
      order: index + 1, day, locationId: location.id, locationName: location.name, arabicName: location.arabicName,
      latitude: location.latitude ?? 31.778, longitude: location.longitude ?? 35.235,
      suggestedMinutes: stopMinutes, walkFromPreviousMinutes: walk, distanceFromPreviousMeters: leg.meters, bearingFromPreviousDegrees: leg.bearing,
      guidance: location.profile?.landmarks.slice(0, 2).join(" · ") || "Follow the reviewed location story.",
      arabicGuidance: location.profile?.arabicLandmarks.slice(0, 2).join(" · ") || "اتبع حكاية المكان المراجعة.",
      frenchGuidance: location.profile?.landmarks.slice(0, 2).join(" · ") || "Suivez le récit documenté de ce lieu.",
      matchedInterests: matched,
    };
  });
  return {
    id: `quds-${Date.now()}`, createdAt: new Date().toISOString(), title: preferences.language === "ar" ? "مساري الذكي في القدس" : preferences.language === "fr" ? "Mon itinéraire intelligent à Jérusalem" : "My smart Jerusalem route",
    preferences, totalMinutes: stops.reduce((sum, stop) => sum + stop.suggestedMinutes + stop.walkFromPreviousMinutes, 0), totalWalkingMinutes: walking, stops,
    uncertaintyNotes: preferences.language === "ar"
      ? ["أوقات المشي تقديرية؛ افتح الاتجاهات الحية لكل مقطع وراعِ مداخل الأبواب وساعات الفتح والتضاريس والظروف المحلية.", "تعتمد التوصيات على سجلات حكاية المراجعة ولا تضيف ادعاءات تاريخية غير موثقة."]
      : preferences.language === "fr"
        ? ["Les temps de marche sont approximatifs : ouvrez l’itinéraire en direct pour chaque étape et vérifiez les accès, les horaires, le relief et les conditions locales.", "Les recommandations reposent uniquement sur les dossiers vérifiés de Hikaya."]
        : ["Walking times are approximate; open live directions for each leg and account for gate access, opening hours, terrain and current local conditions.", "Recommendations use reviewed Hikaya records; the route does not invent historical claims."],
  };
}

export const PersonalizedTourModal: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const navigate = useNavigate();
  const { locations, loading } = useLocations();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<TourPreferences>({ language: "ar", duration: "half_day", interests: ["history", "architecture"] });
  const canContinue = step < 2 || preferences.interests.length > 0;
  const summary = useMemo(() => DURATIONS.find((item) => item.id === preferences.duration), [preferences.duration]);
  const toggleInterest = (interest: TourInterest) => setPreferences((current) => ({ ...current, interests: current.interests.includes(interest) ? current.interests.filter((item) => item !== interest) : [...current.interests, interest] }));
  const tourLanguageLabel = (ar: string, en: string, fr: string) => preferences.language === "ar" ? ar : preferences.language === "fr" ? fr : en;
  const generate = () => {
    const itinerary = buildItinerary(preferences, locations);
    window.localStorage.setItem(ITINERARY_KEY, JSON.stringify(itinerary));
    navigate("/map?tour=1");
  };

  return (
    <div className="max-w-4xl mx-auto" dir={isArabic ? "rtl" : "ltr"}>
      <section className="bg-brand-surface rounded-3xl border border-brand-border shadow-2xl overflow-hidden">
        <div className="bg-brand-olive text-white p-7 sm:p-10 relative overflow-hidden">
          <div className="absolute inset-0 tatreez-grid opacity-10" />
          <div className="relative"><p className="text-brand-amber-light text-xs font-bold tracking-widest">{isArabic ? "مخطط المسار الذكي" : "SMART ROUTE PLANNER"}</p><h1 className="font-serif font-black text-3xl sm:text-4xl mt-2">{isArabic ? "خطّط مسار مشي في القدس" : "Plan a Jerusalem walking route"}</h1><p className="text-stone-200 text-sm mt-2">{isArabic ? "ثلاث خطوات لمسار شخصي، قابل للاستخدام دون اتصال، ومبني على محتوى موثّق." : "Three steps to a personalized, offline-ready route grounded in reviewed content."}</p></div>
        </div>
        <div className="p-6 sm:p-10 space-y-8">
          <div className="flex gap-2" aria-label={isArabic ? "التقدم" : "Progress"}>{[0,1,2].map((item) => <span key={item} className={`h-2 flex-1 rounded-full ${item <= step ? "bg-brand-amber" : "bg-brand-border-light"}`} />)}</div>
          {step === 0 && <ChoiceGrid icon={Languages} title={isArabic ? "1. اختر لغة الجولة" : "1. Choose the tour language"}>{LANGUAGES.map((item) => <Choice key={item.id} selected={preferences.language === item.id} onClick={() => setPreferences({ ...preferences, language: item.id })}>{item.label}</Choice>)}</ChoiceGrid>}
          {step === 1 && <ChoiceGrid icon={Clock3} title={isArabic ? "2. كم من الوقت لديك؟" : "2. How much time do you have?"}>{DURATIONS.map((item) => <Choice key={item.id} selected={preferences.duration === item.id} onClick={() => setPreferences({ ...preferences, duration: item.id })}>{tourLanguageLabel(item.ar, item.en, FRENCH_DURATION_LABELS[item.id])}</Choice>)}</ChoiceGrid>}
          {step === 2 && <ChoiceGrid icon={Sparkles} title={isArabic ? "3. ما الذي يهمك؟ (اختر أكثر من خيار)" : "3. What interests you? (Choose more than one)"}>{INTERESTS.map((item) => <Choice key={item.id} selected={preferences.interests.includes(item.id)} onClick={() => toggleInterest(item.id)}>{tourLanguageLabel(item.ar, item.en, FRENCH_INTEREST_LABELS[item.id])}</Choice>)}</ChoiceGrid>}
          <div className="bg-brand-bg rounded-2xl p-4 text-xs text-brand-muted">{isArabic ? `سيختار الدليل حتى ${summary?.count} محطات داخل القدس، يرتبها لتقليل الرجوع، ويعرض وقت المشي التقريبي والمسار على الخريطة.` : `The guide will choose up to ${summary?.count} Jerusalem stops, reduce backtracking, and show estimated walking time and the route on the map.`}</div>
          <div className="flex justify-between gap-3">
            <button type="button" onClick={() => step === 0 ? navigate(-1) : setStep(step - 1)} className="border border-brand-border px-5 py-3 rounded-full text-xs font-bold inline-flex items-center gap-2"><ArrowRight className={`w-4 h-4 ${isArabic ? "" : "rotate-180"}`} /> {isArabic ? "رجوع" : "Back"}</button>
            {step < 2 ? <button type="button" disabled={!canContinue} onClick={() => setStep(step + 1)} className="bg-brand-olive text-white px-6 py-3 rounded-full text-xs font-bold inline-flex items-center gap-2">{isArabic ? "التالي" : "Next"} <ArrowLeft className={`w-4 h-4 ${isArabic ? "" : "rotate-180"}`} /></button> : <button type="button" disabled={loading || !preferences.interests.length} onClick={generate} className="bg-brand-amber text-white px-6 py-3 rounded-full text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50"><Route className="w-4 h-4" /> {isArabic ? "أنشئ المسار" : "Build route"}</button>}
          </div>
        </div>
      </section>
    </div>
  );
};

const ChoiceGrid: React.FC<React.PropsWithChildren<{ icon: React.ElementType; title: string }>> = ({ icon: Icon, title, children }) => <div className="space-y-4"><h2 className="font-serif font-black text-xl text-brand-olive inline-flex items-center gap-2"><Icon className="w-5 h-5 text-brand-amber" />{title}</h2><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div></div>;
const Choice: React.FC<React.PropsWithChildren<{ selected: boolean; onClick: () => void }>> = ({ selected, onClick, children }) => <button type="button" onClick={onClick} className={`p-4 rounded-2xl border text-start text-sm font-bold transition-colors inline-flex justify-between items-center ${selected ? "bg-brand-olive text-white border-brand-olive" : "bg-brand-surface border-brand-border hover:border-brand-amber"}`}>{children}{selected && <Check className="w-4 h-4 text-brand-amber-light" />}</button>;
