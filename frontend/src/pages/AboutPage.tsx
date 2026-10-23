import React from "react";
import { AboutPanel } from "../components/AboutPanel";
import { useInterfaceLanguage } from "../context/LanguageContext";

export const AboutPage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif font-black text-3xl text-brand-olive">{isArabic ? "عن حكاية" : "About Hikaya"}</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {isArabic ? "دليل شخصي للتراث الفلسطيني" : "Personalized guidance through Palestinian heritage."}
        </p>
      </div>
      <AboutPanel />
    </div>
  );
};
