/**
 * Phone numbers for sign-up and log-in, in E.164 (`+970599123456`).
 *
 * The same rules as backend/src/accounts/phone.ts, which has the final say;
 * this copy lets the form show the number it will save, and explain a typo in
 * the visitor's language before anything is sent.
 */

export interface CountryCode {
  code: string;
  flag: string;
  ar: string;
  en: string;
}

/** Palestine first, then where most visitors and the diaspora call from. */
export const COUNTRY_CODES: CountryCode[] = [
  { code: "+970", flag: "🇵🇸", ar: "فلسطين", en: "Palestine" },
  { code: "+972", flag: "🇵🇸", ar: "القدس والداخل", en: "Jerusalem & 1948 areas" },
  { code: "+962", flag: "🇯🇴", ar: "الأردن", en: "Jordan" },
  { code: "+20", flag: "🇪🇬", ar: "مصر", en: "Egypt" },
  { code: "+961", flag: "🇱🇧", ar: "لبنان", en: "Lebanon" },
  { code: "+963", flag: "🇸🇾", ar: "سوريا", en: "Syria" },
  { code: "+964", flag: "🇮🇶", ar: "العراق", en: "Iraq" },
  { code: "+966", flag: "🇸🇦", ar: "السعودية", en: "Saudi Arabia" },
  { code: "+971", flag: "🇦🇪", ar: "الإمارات", en: "UAE" },
  { code: "+974", flag: "🇶🇦", ar: "قطر", en: "Qatar" },
  { code: "+965", flag: "🇰🇼", ar: "الكويت", en: "Kuwait" },
  { code: "+90", flag: "🇹🇷", ar: "تركيا", en: "Türkiye" },
  { code: "+49", flag: "🇩🇪", ar: "ألمانيا", en: "Germany" },
  { code: "+44", flag: "🇬🇧", ar: "بريطانيا", en: "UK" },
  { code: "+33", flag: "🇫🇷", ar: "فرنسا", en: "France" },
  { code: "+56", flag: "🇨🇱", ar: "تشيلي", en: "Chile" },
  { code: "+1", flag: "🇺🇸", ar: "أمريكا وكندا", en: "US & Canada" },
];

export const DEFAULT_COUNTRY_CODE = "+970";

const NATIONAL_LENGTHS: Record<string, number[]> = {
  "970": [8, 9],
  "972": [8, 9],
  "962": [8, 9],
  "20": [9, 10],
  "966": [8, 9],
  "971": [8, 9],
  "974": [8],
  "965": [8],
  "961": [7, 8],
  "1": [10],
};
const LENGTH_BY_FIRST_DIGIT: Record<string, (first: string) => number> = {
  "970": (first) => ("57".includes(first) ? 9 : 8),
  "972": (first) => ("57".includes(first) ? 9 : 8),
  "962": (first) => (first === "7" ? 9 : 8),
};
const MAX_E164_DIGITS = 15;

function countryCodeOf(digits: string): string | null {
  for (const length of [1, 2, 3]) {
    const code = digits.slice(0, length);
    if (NATIONAL_LENGTHS[code]) return code;
  }
  return null;
}

function isValid(code: string, national: string): boolean {
  if (!/^[1-9]\d{0,2}$/.test(code) || !/^[1-9]\d*$/.test(national)) return false;
  if (code.length + national.length > MAX_E164_DIGITS) return false;
  const byFirstDigit = LENGTH_BY_FIRST_DIGIT[code];
  if (byFirstDigit) return national.length === byFirstDigit(national[0]);
  const lengths = NATIONAL_LENGTHS[code];
  return lengths ? lengths.includes(national.length) : national.length >= 6 && national.length <= 12;
}

/** The E.164 form, or null when the number cannot be a real one. */
export function normalizePhone(countryCode: string, number: string): string | null {
  const typed = number.trim().replace(/[\s\-.()]/g, "");
  const international = /^(?:\+|00)(\d+)$/.exec(typed);
  if (international) {
    const digits = international[1];
    const code = countryCodeOf(digits);
    if (code) return isValid(code, digits.slice(code.length)) ? `+${digits}` : null;
    return digits.length >= 8 && digits.length <= MAX_E164_DIGITS ? `+${digits}` : null;
  }
  if (!/^\d+$/.test(typed)) return null;
  const code = countryCode.trim().replace(/^\+/, "");
  const national = typed.replace(/^0+/, "");
  return isValid(code, national) ? `+${code}${national}` : null;
}

/** "+970599123456" -> "+970 59 912 3456", for showing a saved number. */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/^\+/, "");
  const code = countryCodeOf(digits) ?? COUNTRY_CODES.map((item) => item.code.slice(1)).find((item) => digits.startsWith(item)) ?? digits.slice(0, 3);
  const national = digits.slice(code.length);
  const tail = national.slice(-4);
  const middle = national.slice(-7, -4);
  const head = national.slice(0, -7);
  return `+${code} ${[head, middle, tail].filter(Boolean).join(" ")}`;
}
