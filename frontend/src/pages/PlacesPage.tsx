import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorates } from "../data/heritage";
import { useLocations } from "../hooks/useLocations";
import { useVisitedLocations } from "../hooks/useVisitedLocations";
import { LocationCard } from "../components/LocationCard";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { LoadingRegion, SkeletonCardGrid } from "../components/Skeleton";
import { PageTransition } from "../components/motion";
import { categoryLabel } from "../utils/categories";
import { governoratesCount, placesCount } from "../utils/plural";
import { placeSearchText, searchTerms } from "../utils/placeSearch";

/** One list of every place in the archive, with search and filters. */
export const PlacesPage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { locations, loading, source, reason } = useLocations("all");
  const visited = useVisitedLocations(locations.length, locations.map((item) => item.id));
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const governorateFilter = params.get("governorate") ?? "";
  const categoryFilter = params.get("category") ?? "";

  // Filters live in the address so a search can be shared or bookmarked.
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const indexed = useMemo(
    () => locations.map((location) => ({ location, text: placeSearchText(location) })),
    [locations],
  );
  const categories = useMemo(
    () => [...new Set(locations.flatMap((location) => location.categories))].sort(),
    [locations],
  );
  const terms = searchTerms(query);
  const results = indexed
    .filter(({ location, text }) =>
      (!governorateFilter || (location.governorateId ?? "jerusalem") === governorateFilter) &&
      (!categoryFilter || location.categories.includes(categoryFilter)) &&
      terms.every((term) => text.includes(term)),
    )
    .map(({ location }) => location);
  const filtered = Boolean(query || governorateFilter || categoryFilter);

  const chip = (active: boolean) =>
    `min-h-10 rounded-full border px-4 text-sm font-bold transition-colors ${
      active
        ? "border-brand-olive bg-brand-olive text-white"
        : "border-brand-border bg-brand-surface text-brand-olive hover:border-brand-amber"
    }`;

  return (
    <PageTransition>
      <div className="space-y-8">
        <DataSourceBanner source={source} reason={reason} />
        <header className="space-y-2">
          <h1 className="font-serif text-3xl font-black text-brand-olive sm:text-4xl">
            {isArabic ? "كل الأماكن" : "All places"}
          </h1>
          <p className="text-sm text-brand-muted">
            {isArabic
              ? `${placesCount(locations.length || 0, true)} في ${governoratesCount(governorates.length, true)}. ابحث بالاسم أو المدينة أو الموضوع.`
              : `${placesCount(locations.length || 0, false)} across ${governoratesCount(governorates.length, false)}. Search by name, city or theme.`}
          </p>
        </header>

        <section className="space-y-4" aria-label={isArabic ? "البحث والتصفية" : "Search and filters"}>
          <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => update("q", event.target.value)}
              placeholder={isArabic ? "ابحث: سبسطية، كنيسة، سوق، أريحا…" : "Search: Sebastia, church, souq, Jericho…"}
              aria-label={isArabic ? "ابحث في الأماكن" : "Search places"}
              className="h-14 w-full rounded-2xl border border-brand-border bg-brand-surface ps-12 pe-12 text-base text-brand-text shadow-sm outline-none transition focus:border-brand-amber focus:ring-2 focus:ring-brand-amber/30 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => update("q", "")}
                className="absolute end-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-brand-muted hover:bg-brand-bg hover:text-brand-olive"
                aria-label={isArabic ? "امسح البحث" : "Clear search"}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          <div className="space-y-2">
            <p className="text-xs font-bold text-brand-muted">{isArabic ? "المحافظة" : "Governorate"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!governorateFilter} onClick={() => update("governorate", "")} className={chip(!governorateFilter)}>
                {isArabic ? "الكل" : "All"}
              </button>
              {governorates.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={governorateFilter === item.id}
                  onClick={() => update("governorate", governorateFilter === item.id ? "" : item.id)}
                  className={chip(governorateFilter === item.id)}
                >
                  {isArabic ? item.arabicName : item.name}
                </button>
              ))}
            </div>
          </div>

          {categories.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-brand-muted">{isArabic ? "النوع" : "Type"}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={!categoryFilter} onClick={() => update("category", "")} className={chip(!categoryFilter)}>
                  {isArabic ? "الكل" : "All"}
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={categoryFilter === category}
                    onClick={() => update("category", categoryFilter === category ? "" : category)}
                    className={chip(categoryFilter === category)}
                  >
                    {categoryLabel(category, isArabic)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <>
            <SkeletonCardGrid />
            <LoadingRegion label={isArabic ? "جارٍ تحميل الأماكن" : "Loading places"} />
          </>
        ) : (
          <section className="space-y-4" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-brand-olive">
                {filtered
                  ? isArabic
                    ? `${placesCount(results.length, true)} من ${locations.length}`
                    : `${placesCount(results.length, false)} of ${locations.length}`
                  : placesCount(results.length, isArabic)}
              </p>
              {filtered && (
                <button
                  type="button"
                  onClick={() => setParams(new URLSearchParams(), { replace: true })}
                  className="text-sm font-bold text-brand-amber hover:text-brand-amber-deep"
                >
                  {isArabic ? "امسح البحث والتصفية" : "Clear search and filters"}
                </button>
              )}
            </div>
            {results.length ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {results.map((location) => (
                  <LocationCard key={location.id} location={location} visited={visited.hasVisited(location.id)} />
                ))}
              </div>
            ) : (
              <p className="rounded-3xl border border-brand-border bg-brand-surface p-8 text-center text-sm text-brand-muted">
                {isArabic
                  ? "لا يوجد مكان يطابق بحثك. جرّب كلمة أقصر أو امسح التصفية."
                  : "No place matches your search. Try a shorter word or clear the filters."}
              </p>
            )}
          </section>
        )}
      </div>
    </PageTransition>
  );
};
