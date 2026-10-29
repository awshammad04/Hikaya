import { governorateName, locationById, nationalRecord } from "../data/heritage";
import { categoryLabel } from "./categories";
import { ApiLocation } from "../types";

/**
 * Folds the spellings people type interchangeably (hamza forms, taa marbuta,
 * alif maqsura, diacritics, letter case) so "اريحا" finds "أريحا".
 */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every name, place and theme a visitor might search a location by. */
export function placeSearchText(location: ApiLocation): string {
  const profile = locationById(location.id);
  const record = nationalRecord(location.id);
  const governorateId = location.governorateId ?? "jerusalem";
  return normalizeSearch(
    [
      location.name,
      location.arabicName,
      profile?.arabicName,
      location.description,
      profile?.summary,
      profile?.arabicSummary,
      location.city,
      record?.arabicCity,
      governorateName(governorateId, true),
      governorateName(governorateId, false),
      ...location.categories.flatMap((category) => [category, categoryLabel(category, false)]),
      ...(profile?.landmarks ?? []),
      ...(profile?.arabicLandmarks ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** The words of a query, folded the same way as the search text. */
export function searchTerms(query: string): string[] {
  return normalizeSearch(query).split(" ").filter(Boolean);
}
