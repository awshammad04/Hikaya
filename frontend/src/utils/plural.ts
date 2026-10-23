/**
 * Arabic counted nouns change form with the number: one, two (dual),
 * three to ten (plural) and eleven or more (singular accusative).
 */
export interface ArabicForms {
  one: string;
  two: string;
  few: (n: number) => string;
  many: (n: number) => string;
}

export function arabicCount(n: number, forms: ArabicForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const mod = n % 100;
  if (n === 0 || (mod >= 3 && mod <= 10)) return forms.few(n);
  return forms.many(n);
}

export function placesCount(n: number, isArabic: boolean): string {
  if (!isArabic) return `${n} place${n === 1 ? "" : "s"}`;
  return arabicCount(n, {
    one: "مكان واحد",
    two: "مكانان",
    few: (count) => `${count} أماكن`,
    many: (count) => `${count} مكاناً`,
  });
}

export function documentedPlacesCount(n: number, isArabic: boolean): string {
  if (!isArabic) return `${n} documented place${n === 1 ? "" : "s"}`;
  return arabicCount(n, {
    one: "مكان موثّق واحد",
    two: "مكانان موثّقان",
    few: (count) => `${count} أماكن موثّقة`,
    many: (count) => `${count} مكاناً موثّقاً`,
  });
}

export function governoratesCount(n: number, isArabic: boolean): string {
  if (!isArabic) return `${n} governorate${n === 1 ? "" : "s"}`;
  return arabicCount(n, {
    one: "محافظة واحدة",
    two: "محافظتان",
    few: (count) => `${count} محافظات`,
    many: (count) => `${count} محافظة`,
  });
}
