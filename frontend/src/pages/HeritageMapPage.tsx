import React, { useState } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { MvpLocationMap } from "../components/MvpLocationMap";
import { LocationCard } from "../components/LocationCard";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { useLocations } from "../hooks/useLocations";
import { useVisitedLocations } from "../hooks/useVisitedLocations";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorates, governorateById } from "../data/heritage";
import { ApiLocation } from "../types";
import { PageTransition } from "../components/motion";

export const NATIONAL_BOUNDS = {
  minLat: Math.min(...governorates.map((item) => item.bounds.minLat)) - 0.06,
  maxLat: Math.max(...governorates.map((item) => item.bounds.maxLat)) + 0.06,
  minLng: Math.min(...governorates.map((item) => item.bounds.minLng)) - 0.1,
  maxLng: Math.max(...governorates.map((item) => item.bounds.maxLng)) + 0.1,
};
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
        <p className="text-xs text-brand-muted">
          {isArabic
            ? "اختر محافظة أو مكاناً لقراءة سجله. الخريطة للاستكشاف الثقافي."
            : "Select a governorate or place to read its record. This map supports cultural exploration."}
        </p>
        {!governorate && (
          <div className="flex flex-wrap gap-3">
            <button
              aria-pressed={!showSites}
              onClick={() => {
                setShowSites(false);
                setSelected(null);
              }}
              className="rounded-full border border-brand-border bg-white px-5 py-2 text-xs font-bold text-brand-olive"
            >
              {isArabic ? "المحافظات" : "Governorates"}
            </button>
            <button
              aria-pressed={showSites}
              onClick={() => {
                setShowSites(true);
                setSelected(null);
              }}
              className="rounded-full border border-brand-border bg-white px-5 py-2 text-xs font-bold text-brand-olive"
            >
              {isArabic ? "أماكن التراث" : "Heritage sites"}
            </button>
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
                bounds={governorate?.bounds ?? NATIONAL_BOUNDS}
                mapLabel={title}
                jerusalem={false}
                drawRoute={false}
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
                    className="block rounded-3xl border border-brand-border bg-white p-6 text-xl font-serif font-black text-brand-olive"
                  >
                    {isArabic ? selected.arabicName : selected.name} →
                  </Link>
                ))}
              {governorate || showSites
                ? locations.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className="block w-full rounded-2xl border border-brand-border bg-white p-4 text-start text-sm text-brand-olive"
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
                      className="block rounded-2xl border border-brand-border bg-white p-4 text-sm text-brand-olive"
                    >
                      {isArabic ? item.arabicName : item.name} →
                    </Link>
                  ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};
