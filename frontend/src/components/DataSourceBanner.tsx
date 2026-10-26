import React from "react";
import { CloudOff } from "lucide-react";
import { DataSource } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";

interface DataSourceBannerProps {
  source: DataSource;
  reason?: string;
}

/**
 * Shown whenever the page is displaying mock data because the backend could not
 * be reached.
 *
 * The mock data is deliberately identical in shape and content to the seeded
 * database, which makes it easy to mistake for live data - so the UI says so
 * outright rather than letting the reader assume.
 */
export const DataSourceBanner: React.FC<DataSourceBannerProps> = ({ source, reason }) => {
  const { isArabic } = useInterfaceLanguage();
  if (import.meta.env?.PROD && reason) return (
    <div role="alert" className="mb-6 rounded-2xl border border-brand-amber/30 bg-brand-amber/10 px-4 py-3 text-sm">
      {isArabic ? "الخدمة غير متاحة مؤقتاً. يرجى إعادة المحاولة." : "The service is temporarily unavailable. Please try again."}
    </div>
  );
  if (source === "backend") return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-2xl border border-brand-amber/30 bg-brand-amber/10 px-4 py-3">
      <CloudOff className="w-4 h-4 text-brand-amber shrink-0 mt-0.5" />
      <div className="text-xs text-brand-text leading-relaxed">
        <p className="font-bold text-brand-amber uppercase tracking-wider text-xs font-mono">
          {isArabic ? "وضع عدم الاتصال" : "Offline sample data"}
        </p>
        <p>
          {isArabic ? "تعمل حكاية الآن بالمحتوى الموثّق المحفوظ على جهازك. ستعود المزامنة تلقائياً عند اتصال الخدمة، ويمكنك متابعة الجولة والخرائط والاختبارات دون انقطاع." : "Hikaya is using the reviewed content saved on this device. It will reconnect automatically when the service returns, while tours, maps and quizzes remain available."}
        </p>
      </div>
    </div>
  );
};
