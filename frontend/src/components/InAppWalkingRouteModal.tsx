import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Footprints, MapPin, Navigation2, Route, ShieldCheck, X } from "lucide-react";
import { ApiLocation } from "../types";
import { locationById } from "../data/heritage";
import { useInterfaceLanguage } from "../context/LanguageContext";

interface InAppWalkingRouteModalProps {
  location: ApiLocation | null;
  open: boolean;
  onClose: () => void;
}

/**
 * A route sheet keeps the visitor in the guide first. It deliberately offers
 * orientation and safe walking steps rather than pretending that an offline
 * schematic can provide live turn-by-turn access conditions.
 */
export const InAppWalkingRouteModal: React.FC<InAppWalkingRouteModalProps> = ({ location, open, onClose }) => {
  const { isArabic } = useInterfaceLanguage();
  const profile = location ? locationById(location.id) : undefined;
  const name = isArabic ? (profile?.arabicName ?? location?.arabicName ?? location?.name) : location?.name;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !location || !name) return null;

  const externalUrl = location.latitude != null && location.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&travelmode=walking`
    : undefined;
  const steps = isArabic
    ? [
        "حدّد نقطة بدايتك على هاتفك؛ لا تجمع حكاية موقعك ولا تدّعي معرفة مكانك الحالي.",
        `افتح محطة «${name}» على خريطة الدليل لتقرأ موقعها ضمن الحارات والمعالم القريبة قبل أن تبدأ المشي.`,
        "اتبع الممرات العامة المفتوحة فقط، وتحرك بهدوء في الأزقة والأسواق ومناطق العبادة والسكن.",
        "تحقّق محلياً من الدخول وساعات الفتح والظروف الراهنة؛ قد يتغير الوصول أو اتجاه الحركة خلال اليوم.",
      ]
    : [
        "Set your starting point on your phone; Hikaya neither collects your location nor claims to know where you are.",
        `Open “${name}” on the guide map to see its position among nearby quarters and landmarks before you set off.`,
        "Use only open public passages, moving thoughtfully through lanes, markets, worship spaces and residential areas.",
        "Check local access, opening hours and current conditions on the day; access and movement can change.",
      ];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={isArabic ? "إرشادات المشي داخل الدليل" : "In-guide walking directions"}>
      <button type="button" aria-label={isArabic ? "إغلاق" : "Close"} onClick={onClose} className="absolute inset-0 cursor-default" />
      <section className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-brand-border bg-brand-surface shadow-2xl sm:rounded-3xl" dir={isArabic ? "rtl" : "ltr"}>
        <header className="relative overflow-hidden bg-brand-olive p-6 text-white">
          <div className="absolute inset-0 tatreez-grid opacity-[0.07]" aria-hidden="true" />
          <button type="button" onClick={onClose} className="absolute end-4 top-4 rounded-full bg-white/10 p-2 transition hover:bg-white/20" aria-label={isArabic ? "إغلاق" : "Close"}>
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-amber text-white shadow-lg"><Route className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-mono font-bold uppercase tracking-[0.18em] text-brand-amber">{isArabic ? "داخل حكاية" : "Inside Hikaya"}</p>
              <h2 className="mt-1 font-serif text-2xl font-black">{isArabic ? `طريق المشي إلى ${name}` : `Walk to ${name}`}</h2>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          <p className="text-sm leading-7 text-brand-text">
            {isArabic
              ? "هذه إرشادات بدايةٍ آمنة داخل الدليل. المسار المصوّر يوضح العلاقة المكانية بين المحطات؛ أمّا اتجاهات الشوارع الحية فتحتاج تحققاً محلياً."
              : "These are safe starting steps inside the guide. The illustrated route shows spatial relationships; live street directions still need local verification."}
          </p>

          <ol className="relative space-y-0 before:absolute before:bottom-5 before:start-4 before:top-5 before:w-px before:bg-gradient-to-b before:from-brand-amber before:via-brand-olive before:to-brand-border">
            {steps.map((step, index) => (
              <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
                <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-4 border-white bg-brand-amber text-xs font-black text-white shadow-sm">{index + 1}</span>
                <p className="pt-1 text-sm leading-6 text-brand-text">{step}</p>
              </li>
            ))}
          </ol>

          <div className="rounded-2xl border border-brand-amber/20 bg-brand-amber/10 p-4 text-xs leading-6 text-brand-olive">
            <ShieldCheck className="mb-1 h-4 w-4 text-brand-amber" />
            {isArabic ? "احترم خصوصية السكان والمصلين، ولا تعتمد على مسار رقمي بدلاً من تعليمات الموقع أو إرشادات الوصول الحالية." : "Respect residents’ and worshippers’ privacy, and never treat a digital route as a substitute for onsite directions or current access guidance."}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link to={`/map?focus=${encodeURIComponent(location.id)}`} onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-olive px-4 py-3 text-xs font-bold text-white transition hover:bg-brand-olive-deep">
              <MapPin className="h-4 w-4 text-brand-amber-light" />{isArabic ? "اعرضه على خريطة الدليل" : "Show on guide map"}
            </Link>
            {externalUrl && <a href={externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-border px-4 py-3 text-xs font-bold text-brand-olive transition hover:border-brand-amber">
              <Navigation2 className="h-4 w-4 text-brand-amber" />{isArabic ? "الاتجاهات الحية (اختياري)" : "Live directions (optional)"}<ExternalLink className="h-3 w-3" />
            </a>}
          </div>
          <button type="button" onClick={onClose} className="mx-auto flex items-center gap-1.5 text-xs font-bold text-brand-muted transition hover:text-brand-olive"><Footprints className="h-3.5 w-3.5" />{isArabic ? "عودة إلى الدليل" : "Back to guide"}</button>
        </div>
      </section>
    </div>
  );
};
