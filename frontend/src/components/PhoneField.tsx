import React from "react";
import { ChevronDown } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { COUNTRY_CODES, formatPhone, normalizePhone } from "../utils/phone";

const fieldClass =
  "bg-brand-bg border border-brand-border rounded-xl px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-amber transition-colors";

/**
 * Country code picker plus number box. Always left-to-right, because that is
 * how phone numbers are read even in an Arabic sentence; underneath it shows
 * the number exactly as it will be saved, so a typo is caught before sign-up.
 */
export const PhoneField: React.FC<{
  id: string;
  label: string;
  countryCode: string;
  number: string;
  onCountryCode: (value: string) => void;
  onNumber: (value: string) => void;
  /** Show the "saved as" preview (sign-up) rather than nothing (log-in). */
  preview?: boolean;
}> = ({ id, label, countryCode, number, onCountryCode, onNumber, preview }) => {
  const { isArabic } = useInterfaceLanguage();
  const normalized = number.trim() ? normalizePhone(countryCode, number) : null;
  const selected = COUNTRY_CODES.find((item) => item.code === countryCode) ?? COUNTRY_CODES[0];
  return (
    <div>
      <label className="text-xs font-mono uppercase tracking-widest text-brand-muted block mb-1.5" htmlFor={id}>
        {label}
      </label>
      <div className="flex gap-2" dir="ltr">
        {/* The closed picker shows only flag and code; the list has names. */}
        <div className={`${fieldClass} relative flex shrink-0 items-center gap-1.5 focus-within:border-brand-amber`}>
          <span aria-hidden="true" className="font-mono">{selected.flag} {selected.code}</span>
          <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-brand-muted" />
          <select
            aria-label={isArabic ? "رمز الدولة" : "Country code"}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            value={countryCode}
            onChange={(event) => onCountryCode(event.target.value)}
            autoComplete="tel-country-code"
          >
            {COUNTRY_CODES.map((item) => (
              <option key={`${item.code}-${item.en}`} value={item.code}>
                {item.flag} {item.code} · {isArabic ? item.ar : item.en}
              </option>
            ))}
          </select>
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          className={`${fieldClass} min-w-0 flex-1`}
          value={number}
          onChange={(event) => onNumber(event.target.value)}
          placeholder="059 123 4567"
          maxLength={32}
          required
          autoComplete="tel-national"
        />
      </div>
      {preview && number.trim() && (
        <p className={`text-xs mt-1.5 ${normalized ? "text-brand-muted" : "text-amber-700"}`}>
          {normalized ? (
            <>
              {isArabic ? "سيُحفظ رقمك هكذا: " : "Saved as: "}
              <span dir="ltr" className="font-mono font-bold text-brand-olive">{formatPhone(normalized)}</span>
            </>
          ) : isArabic ? (
            "تحقق من الرقم ورمز الدولة؛ رقم الجوال الفلسطيني مثل 059 123 4567."
          ) : (
            "Check the number and country code — a Palestinian mobile looks like 059 123 4567."
          )}
        </p>
      )}
      <p className="text-xs text-brand-muted mt-1">
        {isArabic ? "من دولة أخرى؟ اكتب الرقم كاملاً بادئاً بـ +" : "Another country? Type the full number starting with +"}
      </p>
    </div>
  );
};
