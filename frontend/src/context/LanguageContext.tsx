import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type InterfaceLanguage = "ar" | "en";

interface LanguageContextValue {
  language: InterfaceLanguage;
  setLanguage: (language: InterfaceLanguage) => void;
  isArabic: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LANGUAGE_KEY = "hikaya-quds.language";

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguage] = useState<InterfaceLanguage>(() => {
    // `?lang=en` lets a shared link or a printed QR code open in the reader's
    // language; otherwise the visitor's last choice is kept.
    const requested = new URLSearchParams(window.location?.search ?? "").get("lang");
    if (requested === "en" || requested === "ar") return requested;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LANGUAGE_KEY);
    } catch {
      // Storage can be blocked (private browsing, strict settings): use Arabic.
    }
    return stored === "en" ? "en" : "ar";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Not remembered across visits, but the page still works.
    }
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, isArabic: language === "ar" }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useInterfaceLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useInterfaceLanguage must be used inside LanguageProvider");
  return value;
}
