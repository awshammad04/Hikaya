import React, { useRef, useState } from "react";
import { Camera, CameraOff, ExternalLink, MoveHorizontal } from "lucide-react";
import { ApiMedia, BeforeAfterResponse } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";

/**
 * Then-and-now comparison of the same subject.
 *
 * Only shown where the archive actually holds a historical photograph and a
 * present-day one *of the same thing*. Where it does not, the component says so
 * rather than sliding between two unrelated pictures and letting the reader
 * infer a change that was never photographed.
 *
 * Works by pointer and by keyboard: the divider is a range input, so arrow keys
 * move it and screen readers announce it.
 */
interface BeforeAfterSliderProps {
  data: BeforeAfterResponse;
  /** A reviewed historical image used when an honest like-for-like pair is absent. */
  fallbackImage?: ApiMedia | null;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ data, fallbackImage }) => {
  const { isArabic } = useInterfaceLanguage();
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  if (!data.pair) {
    const fallbackTitle = isArabic
      ? (fallbackImage?.arabicSubject ?? fallbackImage?.subject ?? "صورة أرشيفية من المكان")
      : (fallbackImage?.subject ?? fallbackImage?.arabicSubject ?? "Documentary archival photograph");
    const fallbackDescription = isArabic
      ? (fallbackImage?.arabicDescription ?? fallbackImage?.description)
      : (fallbackImage?.description ?? fallbackImage?.arabicDescription);

    if (fallbackImage && !fallbackFailed) {
      return (
        <figure className="overflow-hidden rounded-3xl border border-brand-border bg-brand-olive shadow-sm">
          <div className="relative h-72 sm:h-96">
            <img
              src={fallbackImage.thumbUrl ?? fallbackImage.url}
              alt={fallbackDescription ?? fallbackTitle}
              width={fallbackImage.width}
              height={fallbackImage.height}
              onError={() => setFallbackFailed(true)}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
            <div className="absolute start-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/35 bg-black/35 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-white backdrop-blur-sm">
              <Camera className="h-3.5 w-3.5 text-brand-amber" />
              {isArabic ? "صورة أرشيفية توثيقية للمعلم" : "Documentary archival photograph"}
            </div>
            <figcaption className="absolute inset-x-0 bottom-0 space-y-1 p-5 text-white">
              <h3 className="font-serif text-xl font-black">{fallbackTitle}</h3>
              {fallbackDescription && <p className="max-w-3xl text-xs leading-6 text-white/90">{fallbackDescription}</p>}
            </figcaption>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-5 py-3 text-[10px] text-brand-muted" dir={isArabic ? "rtl" : "ltr"}>
            <span>
              <bdi>{fallbackImage.credit}</bdi>
              {fallbackImage.license ? ` · ${fallbackImage.license}` : ""}
            </span>
            {fallbackImage.sourceUrl && (
              <a href={fallbackImage.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-brand-olive hover:text-brand-amber">
                {isArabic ? "المصدر" : "Source"}<ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <p className="border-t border-brand-border-light bg-brand-bg px-5 py-3 text-[11px] leading-5 text-brand-muted">
            {isArabic
              ? "لا توجد بعد صورتان موثقتان للزاوية نفسها، لذلك نعرض هذه الصورة وحدها ولا نصنع مقارنة قد توحي بتغيّر غير مثبت."
              : "The archive does not yet hold two verified views of the same angle, so this photograph is shown on its own rather than implying an unverified comparison."}
          </p>
        </figure>
      );
    }

    return (
      <div className="bg-brand-bg border border-brand-border-light rounded-2xl px-4 py-5 flex items-start gap-3">
        <CameraOff className="w-4 h-4 text-brand-muted shrink-0 mt-0.5" />
        <div className="text-xs text-brand-text leading-relaxed">
          <p className="font-serif font-bold text-brand-olive">
            {isArabic ? "لا توجد مقارنة بين الماضي والحاضر بعد" : "No then-and-now comparison yet"}
          </p>
          <p className="text-brand-muted mt-1">
            {isArabic ? "لا يحتفظ الأرشيف بعد بصورة تاريخية وصورة حديثة للموضوع نفسه. لن نقارن صورتين لمكانين مختلفين لأن ذلك قد يوحي بتغيّر لم يحدث." : <>{data.reason ?? "This location has no historical photograph of the same subject as a present-day one."}{" "}A comparison between two different subjects would show a change that never happened, so none is shown.</>}
          </p>
        </div>
      </div>
    );
  }

  const { before, after } = data.pair;
  const beforeSubject = isArabic ? (before.arabicSubject ?? before.subject) : before.subject;
  const afterSubject = isArabic ? (after.arabicSubject ?? after.subject) : after.subject;
  const beforeDescription = isArabic ? (before.arabicDescription ?? before.description) : before.description;
  const afterDescription = isArabic ? (after.arabicDescription ?? after.description) : after.description;
  const beforeSrc = before.id === "amud-before" ? "/images/jerusalem/bab-al-amud-1925.jpg" : before.url;
  const afterSrc = after.id === "amud-after" ? "/images/jerusalem/bab-al-amud.jpg" : after.url;

  const dragTo = (clientX: number) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const ratio = ((clientX - bounds.left) / bounds.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  };

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative w-full h-72 sm:h-96 rounded-3xl overflow-hidden border border-brand-border bg-brand-olive select-none"
        onPointerMove={(event) => {
          if (event.buttons === 1) dragTo(event.clientX);
        }}
        onPointerDown={(event) => dragTo(event.clientX)}
      >
        {/* Present day sits underneath; the historical plate is clipped over it. */}
        <img
          src={afterSrc}
          alt={afterDescription ?? `${afterSubject} ${isArabic ? "اليوم" : "today"}`}
          width={after.width}
          height={after.height}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={beforeSrc}
            alt={beforeDescription ?? `${beforeSubject} ${isArabic ? "تاريخياً" : "historically"}`}
            width={before.width}
            height={before.height}
            /*
             * Width is pinned to the container, not the clipping box, so the
             * historical image does not squash as the divider moves.
             */
            style={{ width: containerRef.current?.offsetWidth ?? "100%" }}
            className="absolute inset-0 h-full max-w-none object-cover"
            draggable={false}
          />
          <span className="absolute top-3 left-3 bg-white/90 text-brand-olive text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full">
            {before.capturedAt || (isArabic ? "تاريخية" : "Historical")}
          </span>
        </div>

        <span className="absolute top-3 right-3 bg-white/90 text-brand-olive text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full">
          {after.capturedAt || (isArabic ? "اليوم" : "Today")}
        </span>

        <div
          className="absolute inset-y-0 w-0.5 bg-white shadow-lg pointer-events-none"
          style={{ left: `${position}%` }}
        >
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg">
            <MoveHorizontal className="w-4 h-4 text-brand-olive" />
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label={isArabic ? `قارن ${beforeSubject ?? "المكان"} قديماً وحديثاً` : `Compare ${beforeSubject} then and now`}
          className="absolute inset-x-0 bottom-0 w-full opacity-0 h-12 cursor-ew-resize"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] font-mono text-brand-muted">
        <p>
          <span className="font-bold text-brand-olive">{isArabic ? "الماضي:" : "Then:"}</span> {before.credit}
          {before.license ? ` · ${before.license}` : ""}
        </p>
        <p className="sm:text-right">
          <span className="font-bold text-brand-olive">{isArabic ? "الحاضر:" : "Now:"}</span> {after.credit}
          {after.license ? ` · ${after.license}` : ""}
        </p>
      </div>
    </div>
  );
};
