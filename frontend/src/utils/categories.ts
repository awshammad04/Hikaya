/**
 * Place categories are stored in Arabic in the records; English readers see
 * these names instead of the Arabic tag.
 */
const ENGLISH: Record<string, string> = {
  "حارة تاريخية": "Historic quarter",
  "حي مقدسي": "Jerusalem neighbourhood",
  "معلم ديني": "Sacred site",
  "سوق تراثي": "Historic souq",
  "متحف": "Museum",
  "تراث ثقافي": "Cultural heritage",
  "موقع أثري": "Archaeological site",
  "مشهد ثقافي": "Cultural landscape",
  "ذاكرة شفوية": "Oral memory",
};

export function categoryLabel(category: string, isArabic: boolean): string {
  return isArabic ? category : ENGLISH[category] ?? category;
}
