import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarDays, ExternalLink, Footprints, Navigation2, Pencil, Route, Sparkles } from "lucide-react";
import { useLocations } from "../hooks/useLocations";
import { useVisitedLocations } from "../hooks/useVisitedLocations";
import { MvpLocationMap } from "../components/MvpLocationMap";
import { LocationCard } from "../components/LocationCard";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { LoadingRegion, SkeletonCard, SkeletonLine } from "../components/Skeleton";
import { PageTransition } from "../components/motion";
import { ApiLocation, GeneratedItinerary, ItineraryStop, TourLanguage } from "../types";
import { isGeneratedItinerary, ITINERARY_KEY } from "../components/PersonalizedTourModal";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById } from "../data/heritage";
import { InAppWalkingRouteModal } from "../components/InAppWalkingRouteModal";
import { openMyJerusalemStory } from "../services/progress";

function directionName(degrees: number | undefined, language: TourLanguage) {
  if (degrees == null) return "";
  const ar = ["شمالاً", "شمال شرق", "شرقاً", "جنوب شرق", "جنوباً", "جنوب غرب", "غرباً", "شمال غرب"];
  const en = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
  const fr = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"];
  const index = Math.round(degrees / 45) % 8;
  return (language === "ar" ? ar : language === "fr" ? fr : en)[index];
}

function fullRouteUrl(stops: ItineraryStop[]) {
  if (!stops.length) return "";
  const params = new URLSearchParams({ api: "1", origin: `${stops[0].latitude},${stops[0].longitude}`, destination: `${stops.at(-1)!.latitude},${stops.at(-1)!.longitude}`, travelmode: "walking" });
  if (stops.length > 2) params.set("waypoints", stops.slice(1, -1).map((stop) => `${stop.latitude},${stop.longitude}`).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function interestName(interest: ItineraryStop["matchedInterests"][number], language: TourLanguage) {
  const names = {
    history: { ar: "تاريخ", en: "History", fr: "Histoire" },
    architecture: { ar: "عمارة", en: "Architecture", fr: "Architecture" },
    religious: { ar: "مقدسات", en: "Sacred heritage", fr: "Patrimoine sacré" },
    food_markets: { ar: "أسواق ومأكولات", en: "Souqs & food", fr: "Souks et cuisine" },
    oral_heritage: { ar: "ذاكرة شفوية", en: "Oral memory", fr: "Mémoire orale" },
  } as const;
  return names[interest][language];
}

export const MapPage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { locations, loading, source, reason } = useLocations();
  const visitedState = useVisitedLocations(locations.length);
  const [selected, setSelected] = useState<ApiLocation | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const savedItinerary = useMemo(() => {
    if (!searchParams.get("tour")) return null;
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(ITINERARY_KEY) ?? "null");
      return isGeneratedItinerary(parsed) ? parsed : null;
    } catch { return null; }
  }, [searchParams]);
  const itinerary = useMemo<GeneratedItinerary | null>(() => {
    if (!savedItinerary || !locations.length) return null;
    const validIds = new Set(locations.map((location) => location.id));
    const stops = savedItinerary.stops
      .filter((stop) => validIds.has(stop.locationId))
      .map((stop, index) => ({
        ...stop,
        order: index + 1,
        day: stop.day === 2 ? 2 : 1,
        frenchGuidance: stop.frenchGuidance || stop.guidance,
      }));
    return stops.length ? { ...savedItinerary, stops } : null;
  }, [locations, savedItinerary]);
  const tourLanguage = itinerary?.preferences.language ?? (isArabic ? "ar" : "en");
  const tourText = (ar: string, en: string, fr: string) => tourLanguage === "ar" ? ar : tourLanguage === "fr" ? fr : en;
  const focusedLocationId = searchParams.get("focus");

  useEffect(() => {
    if (!selected && locations.length > 0) {
      const firstRouteId = focusedLocationId ?? itinerary?.stops[0]?.locationId;
      setSelected(locations.find((location) => location.id === firstRouteId) ?? locations[0]);
    }
  }, [focusedLocationId, itinerary, locations, selected]);

  return (
    <PageTransition>
      <div className="space-y-8">
        <DataSourceBanner source={source} reason={reason} />
        <div>
          <h1 className="font-serif font-black text-3xl text-brand-olive">{isArabic ? "خريطة القدس التفاعلية" : "Interactive Jerusalem map"}</h1>
          <p className="text-xs text-brand-muted font-serif">{isArabic ? "اقرأ جغرافية المدينة، اختر محطة، وافتح إرشادات المشي داخل الدليل قبل الانتقال الاختياري إلى الملاحة الحية." : "Read the city’s geography, select a stop, and open in-guide walking guidance before optionally moving to live navigation."}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <SkeletonLine className="lg:col-span-7 h-[610px] w-full rounded-3xl" />
            <div className="lg:col-span-5"><SkeletonCard /></div>
            <LoadingRegion label={isArabic ? "جارٍ تحميل الخريطة" : "Loading the map"} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 lg:sticky lg:top-4">
              <MvpLocationMap locations={locations} selectedId={selected?.id} onSelect={setSelected} visited={visitedState.visited} routeIds={itinerary?.stops.map((stop) => stop.locationId)} />
            </div>

            <div className="lg:col-span-4 space-y-4">
              {itinerary && (
                <section className="bg-brand-olive text-white rounded-3xl p-5 space-y-4" dir={tourLanguage === "ar" ? "rtl" : "ltr"}>
                  <div>
                    <p className="text-[10px] text-brand-amber uppercase tracking-widest inline-flex items-center gap-1.5"><Route className="w-3 h-3" />{tourText("حكاية", "Hikaya", "Hikaya")}</p>
                    <h2 className="font-serif font-black text-xl">{itinerary.title}</h2>
                    <p className="text-xs text-stone-300">{tourText(`${itinerary.stops.length} محطات · نحو ${Math.round(itinerary.totalMinutes / 6) / 10} ساعة · ${itinerary.totalWalkingMinutes} دقيقة مشي`, `${itinerary.stops.length} stops · ~${Math.round(itinerary.totalMinutes / 6) / 10} h · ${itinerary.totalWalkingMinutes} min walking`, `${itinerary.stops.length} étapes · environ ${Math.round(itinerary.totalMinutes / 6) / 10} h · ${itinerary.totalWalkingMinutes} min à pied`)}</p>
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <a href={fullRouteUrl(itinerary.stops)} target="_blank" rel="noreferrer" className="bg-brand-amber hover:bg-[#b45f05] text-white rounded-xl px-4 py-3 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors">
                      <Navigation2 className="w-4 h-4" />{tourText("افتح المسار كاملاً", "Open complete route", "Ouvrir l’itinéraire")}<ExternalLink className="w-3 h-3" />
                    </a>
                    <Link to="/plan-tour" className="rounded-xl border border-white/25 px-3 grid place-items-center hover:bg-white/10" aria-label={tourText("عدّل الجولة", "Edit tour", "Modifier le parcours")} title={tourText("عدّل الجولة", "Edit tour", "Modifier le parcours")}><Pencil className="w-4 h-4" /></Link>
                  </div>

                  <ol className="space-y-2">
                    {itinerary.stops.map((stop, index) => {
                      const previous = itinerary.stops[index - 1];
                      const profile = locationById(stop.locationId);
                      const distance = stop.distanceFromPreviousMeters ?? 0;
                      const direction = directionName(stop.bearingFromPreviousDegrees, tourLanguage);
                      const dayStarts = itinerary.preferences.duration === "weekend" && (index === 0 || stop.day !== itinerary.stops[index - 1]?.day);
                      const stopName = tourLanguage === "ar" ? (profile?.arabicName ?? stop.arabicName ?? stop.locationName) : stop.locationName;
                      const stopGuidance = tourLanguage === "ar" ? stop.arabicGuidance : tourLanguage === "fr" ? stop.frenchGuidance : stop.guidance;
                      return <React.Fragment key={stop.locationId}>
                        {dayStarts && <li className="pt-2 first:pt-0 text-[10px] uppercase tracking-widest text-brand-amber inline-flex items-center gap-1.5"><CalendarDays className="w-3 h-3" />{tourText(`اليوم ${stop.day}`, `Day ${stop.day}`, `Jour ${stop.day}`)}</li>}
                        <li className="bg-white/10 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setSelected(locations.find((item) => item.id === stop.locationId) ?? null)} className="w-7 h-7 rounded-full bg-brand-amber flex items-center justify-center font-bold shrink-0">{stop.order}</button>
                          <div className="min-w-0">
                            <Link to={`/locations/${stop.locationId}?tour=1`} className="font-bold hover:text-brand-amber">{stopName}</Link>
                            <p className="text-stone-300 mt-1">{stopGuidance}</p>
                            {stop.matchedInterests.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{stop.matchedInterests.map((interest) => <span key={interest} className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-stone-200">{interestName(interest, tourLanguage)}</span>)}</div>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                          <span className="text-[10px] text-stone-300 inline-flex items-center gap-1"><Footprints className="w-3 h-3" />{previous ? tourText(`${stop.walkFromPreviousMinutes} د · ${distance ? `${distance} م · ` : ""}${direction}`, `${stop.walkFromPreviousMinutes} min · ${distance ? `${distance} m · ` : ""}${direction}`, `${stop.walkFromPreviousMinutes} min · ${distance ? `${distance} m · ` : ""}${direction}`) : tourText("نقطة البداية", "Starting point", "Point de départ")}</span>
                          <button type="button" onClick={() => { setSelected(locations.find((item) => item.id === stop.locationId) ?? null); setRouteOpen(true); }} className="text-brand-amber hover:text-white inline-flex items-center gap-1 font-bold"><Navigation2 className="w-3 h-3" />{tourText("إرشادات", "Guide", "Guide")}</button>
                        </div>
                        </li>
                      </React.Fragment>;
                    })}
                  </ol>
                  <p className="text-[10px] text-stone-300 border-t border-white/10 pt-3">{itinerary.uncertaintyNotes[0]}</p>
                  <button type="button" onClick={openMyJerusalemStory} className="w-full rounded-xl border border-brand-amber/50 bg-brand-amber/15 px-4 py-3 text-xs font-bold text-white transition hover:bg-brand-amber/25 inline-flex items-center justify-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-amber" />{tourText("إنشاء حكايتي في القدس", "Generate My Jerusalem Story", "Créer mon histoire de Jérusalem")}
                  </button>
                </section>
              )}

              {selected ? (
                <>
                  <LocationCard location={selected} visited={visitedState.hasVisited(selected.id)} />
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => navigate(`/locations/${selected.id}`)} className="bg-brand-olive hover:bg-[#4a4a35] text-white text-xs font-bold px-4 py-3 rounded-full transition-colors">{isArabic ? "افتح المكان" : `Open ${selected.name}`}</button>
                    {selected.latitude != null && selected.longitude != null && <button type="button" onClick={() => setRouteOpen(true)} className="border border-brand-border hover:border-brand-amber text-brand-olive text-xs font-bold px-4 py-3 rounded-full transition-colors inline-flex items-center justify-center gap-1.5"><Navigation2 className="w-4 h-4 text-brand-amber" />{isArabic ? "إرشادات المشي" : "Walking guide"}</button>}
                  </div>
                </>
              ) : <p className="text-xs text-brand-muted font-serif italic">{isArabic ? "لم يُختر مكان بعد." : "No location selected."}</p>}
            </div>
          </div>
        )}
      </div>
      <InAppWalkingRouteModal location={selected} open={routeOpen} onClose={() => setRouteOpen(false)} />
    </PageTransition>
  );
};
