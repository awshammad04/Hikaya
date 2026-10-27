import React, { useMemo, useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { fitBounds, MvpLocationMap } from "../components/MvpLocationMap";
import { LocationCard } from "../components/LocationCard";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { useLocations } from "../hooks/useLocations";
import { useVisitedLocations } from "../hooks/useVisitedLocations";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorates, governorateById } from "../data/heritage";
import { ApiLocation } from "../types";
import { PageTransition } from "../components/motion";
import { OVERVIEW_BOUNDS } from "../components/PalestineGeography";
import { placesCount } from "../utils/plural";

// Wide enough to show the coast and the Jordan valley for orientation; maps
// with places frame them instead (fitBounds), which keeps the coast in view.
export const NATIONAL_BOUNDS = OVERVIEW_BOUNDS;
export const HeritageMapPage: React.FC = () => {
  const { governorateId } = useParams();
  const governorate = governorateId ? governorateById(governorateId) : null;
  const { isArabic } = useInterfaceLanguage();
  const { locations, loading, source, reason } = useLocations(
    governorateId ?? "all",
  );
  const visited = useVisitedLocations(
    locations.length,
    locations.map((item) => item.id),
  );
  const [selected, setSelected] = useState<ApiLocation | null>(null);
  const [showSites, setShowSites] = useState(false);
  // Frame the places; a fixed box can leave them on the edge, under the
  // map's cards. Every governorate centre lies among its places.
  const bounds = useMemo(
    () => fitBounds(locations, governorate?.bounds ?? NATIONAL_BOUNDS),
    [governorate, locations],
  );
  if (governorateId && !governorate)
    return <Navigate to="/palestine-map" replace />;
  if (governorateId === "jerusalem") return <Navigate to="/map" replace />;
  const title = isArabic
    ? governorate
      ? `خريطة ${governorate.arabicName}`
      : "خريطة فلسطين"
    : governorate
      ? `${governorate.name} map`
      : "Palestine map";
  const toggleClass = (on: boolean) =>
    `rounded-full px-5 py-2 text-sm font-bold transition-colors ${on ? "bg-brand-olive text-white" : "text-brand-olive hover:bg-brand-bg"}`;
  const governorateMarkers: ApiLocation[] = governorates.map((item) => ({
    id: item.id,
    name: item.name,
    arabicName: item.arabicName,
    governorateId: item.id,
    country: "Palestine",
    latitude: item.mapCenter.latitude,
    longitude: item.mapCenter.longitude,
    categories: [],
    isPublished: true,
  }));
  return (
    <PageTransition>
      <div className="space-y-6">
        <DataSourceBanner source={source} reason={reason} />
        <h1 className="font-serif text-3xl font-black text-brand-olive">
          {title}
        </h1>
        <p className="text-sm text-brand-muted">
          {isArabic
            ? "اختر محافظة أو مكاناً لقراءة سجله. الخريطة للاستكشاف الثقافي."
            : "Select a governorate or place to read its record. This map supports cultural exploration."}
        </p>
        {!governorate && (
          <div className="inline-flex gap-1 rounded-full border border-brand-border bg-brand-surface p-1">
            <button
              type="button"
              aria-pressed={!showSites}
              onClick={() => {
                setShowSites(false);
                setSelected(null);
              }}
              className={toggleClass(!showSites)}
            >
              {isArabic ? "المحافظات" : "Governorates"}
            </button>
            <button
              type="button"
              aria-pressed={showSites}
              onClick={() => {
                setShowSites(true);
                setSelected(null);
              }}
              className={toggleClass(showSites)}
            >
              {isArabic ? "أماكن التراث" : "Heritage sites"}
            </button>
          </div>
        )}
        {loading && (
          <div className="grid lg:grid-cols-12 gap-6" role="status" aria-label={isArabic ? "جارٍ تحميل الخريطة" : "Loading the map"}>
            <div className="lg:col-span-8 h-[500px] sm:h-[610px] rounded-3xl border border-brand-border bg-[#eae3d3] animate-pulse" />
            <div className="lg:col-span-4 space-y-3" aria-hidden="true">
              {[0, 1, 2].map((item) => <div key={item} className="h-14 rounded-2xl border border-brand-border bg-brand-surface animate-pulse" />)}
            </div>
          </div>
        )}
        {!loading && (
          <div className="grid lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <MvpLocationMap
                key={`${governorateId ?? "national"}-${showSites}`}
                locations={
                  governorate || showSites ? locations : governorateMarkers
                }
                selectedId={selected?.id}
                onSelect={setSelected}
                visited={visited.visited}
                bounds={bounds}
                terrainId={governorate?.id}
                mapLabel={title}
                jerusalem={false}
                drawRoute={false}
                markerKind={governorate || showSites ? "places" : "governorates"}
              />
            </div>
            <div className="lg:col-span-4 space-y-3">
              {selected &&
                (governorate || showSites ? (
                  <LocationCard
                    location={selected}
                    visited={visited.hasVisited(selected.id)}
                  />
                ) : (
                  <Link
                    to={`/governorates/${selected.id}`}
                    className="flex items-center justify-between rounded-3xl border border-brand-amber bg-brand-surface p-6 text-xl font-serif font-black text-brand-olive"
                  >
                    {isArabic ? selected.arabicName : selected.name}
                    <span className="text-sm font-sans font-bold text-brand-amber">{isArabic ? "افتح المحافظة ←" : "Open →"}</span>
                  </Link>
                ))}
              {governorate || showSites
                ? locations.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelected(item)}
                      aria-pressed={selected?.id === item.id}
                      className={`block w-full rounded-2xl border bg-brand-surface p-4 text-start text-sm font-bold text-brand-olive transition-colors hover:border-brand-amber ${selected?.id === item.id ? "border-brand-amber" : "border-brand-border"}`}
                    >
                      {isArabic ? item.arabicName : item.name}
                      {item.latitude == null && (
                        <span className="block mt-1 text-xs text-brand-muted">
                          {isArabic
                            ? "الإحداثيات بانتظار التحقق"
                            : "Coordinates awaiting verification"}
                        </span>
                      )}
                    </button>
                  ))
                : governorates.map((item) => (
                    <Link
                      key={item.id}
                      to={`/governorates/${item.id}/map`}
                      className="flex items-center justify-between rounded-2xl border border-brand-border bg-brand-surface p-4 text-sm font-bold text-brand-olive transition-colors hover:border-brand-amber"
                    >
                      <span>{isArabic ? item.arabicName : item.name}</span>
                      <span className="text-xs font-normal text-brand-muted">
                        {placesCount(locations.filter((place) => (place.governorateId ?? "jerusalem") === item.id).length, isArabic)}
                      </span>
                    </Link>
                  ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};
