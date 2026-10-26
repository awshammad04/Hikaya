import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass, Home, MapPin } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";

/**
 * Shown for any address the app does not know. It used to redirect silently to
 * the home page, which made a mistyped or outdated link look like it worked.
 */
export const NotFoundPage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { pathname } = useLocation();
  return (
    <section className="mx-auto max-w-xl py-16 text-center space-y-6">
      <Compass className="mx-auto h-12 w-12 text-brand-amber" aria-hidden="true" />
      <h1 className="font-serif text-3xl font-black text-brand-olive">
        {isArabic ? "لم نجد هذه الصفحة" : "We could not find this page"}
      </h1>
      <p className="text-brand-muted">
        {isArabic
          ? "ربما تغيّر الرابط أو كُتب بشكل خاطئ. كل حكاية تبدأ من مكان؛ اختر واحداً من هنا."
          : "The link may have changed or been mistyped. Every story starts from a place; pick one from here."}
      </p>
      <p className="font-mono text-xs text-brand-muted break-all" dir="ltr">{pathname}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-brand-olive px-5 py-2.5 text-sm font-bold text-white">
          <Home className="h-4 w-4" aria-hidden="true" />
          {isArabic ? "الرئيسية" : "Home"}
        </Link>
        <Link to="/palestine-map" className="inline-flex items-center gap-2 rounded-full border border-brand-border px-5 py-2.5 text-sm font-bold text-brand-olive">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {isArabic ? "خريطة فلسطين" : "Map of Palestine"}
        </Link>
      </div>
    </section>
  );
};
