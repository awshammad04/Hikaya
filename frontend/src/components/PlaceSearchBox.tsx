import React, { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { governorateName, locationById } from "../data/heritage";
import { normalizeSearch, placeSearchText, searchTerms } from "../utils/placeSearch";
import { placesCount } from "../utils/plural";
import { CoverImage } from "./CoverImage";
import { ApiLocation } from "../types";

const MAX_SUGGESTIONS = 5;

/** Commons resizes on request, so a small thumbnail need not fetch the full cover. */
const thumbnail = (url?: string) => url?.replace(/([?&]width=)\d+/, "$1120");

/**
 * The home page search. Places are suggested as the visitor types, since the
 * whole archive is already in the browser; Enter or the button opens every
 * match on the places page. It sits on a white pill, so it keeps the light
 * palette in both themes.
 */
export const PlaceSearchBox: React.FC<{ locations: ApiLocation[] }> = ({ locations }) => {
  const { isArabic } = useInterfaceLanguage();
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const indexed = useMemo(
    () =>
      locations.map((location) => {
        const profile = locationById(location.id);
        const name = isArabic ? (profile?.arabicName ?? location.arabicName ?? location.name) : location.name;
        return { location, name, image: profile?.coverImage ?? location.coverImageUrl, text: placeSearchText(location) };
      }),
    [locations, isArabic],
  );
  const terms = searchTerms(query);
  const matches = terms.length
    ? indexed
        .filter(({ text }) => terms.every((term) => text.includes(term)))
        // Places named after the query come before those that only mention it.
        .sort((a, b) => {
          const named = (item: typeof a) => terms.every((term) => normalizeSearch(item.name).includes(term));
          return Number(named(b)) - Number(named(a));
        })
    : [];
  const shown = matches.slice(0, MAX_SUGGESTIONS);
  const more = matches.length > shown.length;
  // The last option opens every match when the list is cut short.
  const optionCount = shown.length + (more ? 1 : 0);
  const expanded = open && terms.length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  const showAll = () => {
    const q = query.trim();
    navigate(q ? `/places?q=${encodeURIComponent(q)}` : "/places");
  };
  const choose = (index: number) => {
    if (index < shown.length) navigate(`/locations/${shown[index].location.id}`);
    else showAll();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!optionCount) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => Math.min(optionCount - 1, Math.max(-1, current + step)));
    } else if (event.key === "Enter" && expanded && active >= 0 && active < optionCount) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape" && expanded) {
      // Close the list but keep what was typed.
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  const optionClass = (index: number) =>
    `flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-start transition-colors ${
      index === active ? "bg-brand-bg" : ""
    }`;

  return (
    <div className="paper-scope relative max-w-xl">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          showAll();
        }}
        className="flex gap-2 rounded-full bg-white p-1.5 shadow-lg"
      >
        <label className="relative flex-1">
          <span className="sr-only">{isArabic ? "ابحث عن مكان" : "Search for a place"}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
          <input
            type="search"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              setOpen(false);
              setActive(-1);
            }}
            onKeyDown={onKeyDown}
            placeholder={isArabic ? "ابحث: سبسطية، كنيسة، سوق…" : "Search: Sebastia, church, souq…"}
            className="h-11 w-full rounded-full bg-transparent ps-10 pe-2 text-base text-brand-text outline-none placeholder:text-brand-muted [&::-webkit-search-cancel-button]:hidden"
          />
        </label>
        <button
          type="submit"
          className="shrink-0 rounded-full bg-brand-amber px-5 text-sm font-bold text-white transition-colors hover:bg-brand-amber-deep"
        >
          {isArabic ? "ابحث" : "Search"}
        </button>
      </form>

      {expanded && (
        <div
          id={listId}
          role="listbox"
          aria-label={isArabic ? "أماكن مقترحة" : "Suggested places"}
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-3xl border border-brand-border-light bg-white p-1.5 shadow-xl"
        >
          {shown.length === 0 && (
            <p className="px-3 py-5 text-center text-sm text-brand-muted">
              {isArabic ? "لا يوجد مكان يطابق بحثك. جرّب كلمة أقصر." : "No place matches your search. Try a shorter word."}
            </p>
          )}
          {shown.map(({ location, name, image }, index) => (
            <div
              key={location.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              onMouseMove={() => index !== active && setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
              className={optionClass(index)}
            >
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-brand-olive">
                <CoverImage src={thumbnail(image)} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-brand-text">{name}</span>
                <span className="flex items-center gap-1 text-xs text-brand-muted">
                  <MapPin className="h-3 w-3 text-brand-amber" aria-hidden="true" />
                  {governorateName(location.governorateId ?? "jerusalem", isArabic)}
                </span>
              </span>
            </div>
          ))}
          {more && (
            <div
              id={optionId(shown.length)}
              role="option"
              aria-selected={active === shown.length}
              onMouseMove={() => active !== shown.length && setActive(shown.length)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={showAll}
              className={`${optionClass(shown.length)} justify-between text-sm font-bold text-brand-amber`}
            >
              {isArabic
                ? `اعرض كل النتائج (${placesCount(matches.length, true)})`
                : `See all results (${placesCount(matches.length, false)})`}
              <ArrowLeft className={`h-4 w-4 ${isArabic ? "" : "rotate-180"}`} aria-hidden="true" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
