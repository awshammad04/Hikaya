/**
 * Phone numbers as account identifiers, stored in E.164 (`+970599123456`).
 *
 * Most people write their number the local way ("059 912 3456"), so the
 * trunk 0 is dropped and spaces, dashes, dots and brackets are ignored. A
 * number typed with its own `+` or `00` prefix wins over the chosen country
 * code, which covers countries missing from the picker.
 *
 * There is no SMS check yet, so a typo would lock someone out of their own
 * account; the national lengths below catch the usual slip for the countries
 * most visitors come from. Keep in step with frontend/src/utils/phone.ts.
 */
const NATIONAL_LENGTHS: Record<string, number[]> = {
  // Palestine, Jerusalem and the 1948 areas, and Jordan: the first digit
  // picks the exact length, see LENGTH_BY_FIRST_DIGIT.
  '970': [8, 9],
  '972': [8, 9],
  '962': [8, 9],
  '20': [9, 10], // Egypt
  '966': [8, 9], // Saudi Arabia
  '971': [8, 9], // UAE
  '974': [8], // Qatar
  '965': [8], // Kuwait
  '961': [7, 8], // Lebanon
  '1': [10], // US and Canada
};
/** Where the first digit tells a mobile (longer) from a landline. */
const LENGTH_BY_FIRST_DIGIT: Record<string, (first: string) => number> = {
  '970': (first) => ('57'.includes(first) ? 9 : 8),
  '972': (first) => ('57'.includes(first) ? 9 : 8),
  '962': (first) => (first === '7' ? 9 : 8),
};
const GENERIC_LENGTH = { min: 6, max: 12 };
const MAX_E164_DIGITS = 15;

/** Country calling codes are 1-3 digits and never start with 0. */
const COUNTRY_CODE = /^[1-9]\d{0,2}$/;

/** The calling code an international number starts with, if listed above. */
function countryCodeOf(digits: string): string | null {
  // Calling codes are prefix-free, so at most one length can match.
  for (const length of [1, 2, 3]) {
    const code = digits.slice(0, length);
    if (NATIONAL_LENGTHS[code]) return code;
  }
  return null;
}

function isValid(code: string, national: string): boolean {
  if (!COUNTRY_CODE.test(code) || !/^[1-9]\d*$/.test(national)) return false;
  if (code.length + national.length > MAX_E164_DIGITS) return false;
  const byFirstDigit = LENGTH_BY_FIRST_DIGIT[code];
  if (byFirstDigit) return national.length === byFirstDigit(national[0]);
  const lengths = NATIONAL_LENGTHS[code];
  return lengths
    ? lengths.includes(national.length)
    : national.length >= GENERIC_LENGTH.min &&
        national.length <= GENERIC_LENGTH.max;
}

/**
 * The E.164 form of a number, or null when it cannot be a real one.
 *
 * @param countryCode the picker's value, with or without `+`
 * @param number what the person typed into the number box
 */
export function normalizePhone(
  countryCode: string,
  number: string,
): string | null {
  const typed = number.trim().replace(/[\s\-.()]/g, '');
  const international = /^(?:\+|00)(\d+)$/.exec(typed);
  if (international) {
    const digits = international[1];
    const code = countryCodeOf(digits);
    if (code) {
      const national = digits.slice(code.length);
      return isValid(code, national) ? `+${digits}` : null;
    }
    // Unknown code: only the overall E.164 length can be checked.
    return digits.length >= 8 && digits.length <= MAX_E164_DIGITS
      ? `+${digits}`
      : null;
  }
  if (!/^\d+$/.test(typed)) return null;
  const code = countryCode.trim().replace(/^\+/, '');
  const national = typed.replace(/^0+/, '');
  return isValid(code, national) ? `+${code}${national}` : null;
}

/** For env lists such as HIKAYA_ADMIN_PHONES: already international. */
export function normalizeListedPhone(value: string): string | null {
  return normalizePhone('', value.startsWith('+') ? value : `+${value}`);
}
