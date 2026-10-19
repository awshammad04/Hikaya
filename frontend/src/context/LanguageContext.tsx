import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type InterfaceLanguage = "ar" | "en";

interface LanguageContextValue {
  language: InterfaceLanguage;
  setLanguage: (language: InterfaceLanguage) => void;
  isArabic: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [language, setLanguage] = useState<InterfaceLanguage>(() => {
    const stored = window.localStorage.getItem("hikaya-quds.language");
    return stored === "en" ? "en" : "ar";
  });

  useEffect(() => {
    window.localStorage.setItem("hikaya-quds.language", language);
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
