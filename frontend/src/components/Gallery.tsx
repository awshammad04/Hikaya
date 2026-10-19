import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CameraOff, ChevronLeft, ChevronRight, ExternalLink, RefreshCw, X } from "lucide-react";
import { ApiMedia } from "../types";
import { SkeletonLine } from "./Skeleton";
import { useInterfaceLanguage } from "../context/LanguageContext";

const LOCAL_MEDIA: Record<string, string> = {
  "amud-before": "/images/jerusalem/bab-al-amud-1925.jpg",
  "amud-after": "/images/jerusalem/bab-al-amud.jpg",
  "muslim-souq-2014": "/images/jerusalem/gallery/muslim-souq-2014.jpg",
  "muslim-street-2015": "/images/jerusalem/gallery/muslim-street-2015.jpg",
  "christian-sepulchre-2015": "/images/jerusalem/gallery/christian-sepulchre-2015.jpg",
  "christian-sepulchre-1880": "/images/jerusalem/gallery/christian-sepulchre-1880.jpg",
  "armenian-ceramics-2012": "/images/jerusalem/gallery/armenian-ceramics-2012.jpg",
  "maghariba-quarter-early20c": "/images/jerusalem/gallery/maghariba-quarter-early20c.jpg",
  "maghariba-site-2012": "/images/jerusalem/gallery/maghariba-site-2012.jpg",
  "sheikh-nashashibi-2010": "/images/jerusalem/gallery/sheikh-nashashibi-2010.jpg",
  "sheikh-aerial-1931": "/images/jerusalem/gallery/sheikh-aerial-1931.jpg",
  "silwan-1920": "/images/jerusalem/gallery/silwan-1920.jpg",
  "silwan-spring-2009": "/images/jerusalem/gallery/silwan-spring-2009.jpg",
  "tur-gethsemane-2011": "/images/jerusalem/gallery/at-tur-gethsemane-2011.jpg",
  "amud-khan-zait-2018": "/images/jerusalem/gallery/bab-khan-zait-2018.jpg",
  "muslim-via-dolorosa-2010": "/images/jerusalem/gallery/muslim-via-dolorosa-2010.jpg",
  "christian-muristan-fountain-2013": "/images/jerusalem/gallery/christian-muristan-fountain-2013.jpg",
  "christian-latin-patriarchate-2011": "/images/jerusalem/gallery/christian-latin-patriarchate-2011.jpg",
  "armenian-quarter-detail-2014": "/images/jerusalem/gallery/armenian-quarter-detail-2014.jpg",
  "armenian-patriarchate-street-2014": "/images/jerusalem/gallery/armenian-patriarchate-street-2014.jpg",
  "sheikh-umm-kamel-2009": "/images/jerusalem/gallery/sheikh-umm-kamel-2009.jpg",
  "silwan-ain-1907": "/images/jerusalem/gallery/silwan-ain-1907.jpg",
  "tur-gethsemane-olives-2016": "/images/jerusalem/gallery/at-tur-gethsemane-olives-2016.jpg",
  "tur-aerial-2013": "/images/jerusalem/gallery/at-tur-aerial-2013.jpg",
  "amud-gate-2022": "/images/jerusalem/gallery/bab-al-amud-2022.jpg",
  "amud-khan-zait-2019": "/images/jerusalem/gallery/bab-khan-zait-2019.jpg",
};

const localMedia = (image: ApiMedia) =>
  LOCAL_MEDIA[image.id] ?? (image.pairRole === "cover" ? `/images/jerusalem/${image.locationId}.jpg` : null);

interface GalleryProps {
  images: ApiMedia[];
  loading?: boolean;
}

/**
 * Credit line for an image.
 *
 * Always rendered, never collapsed: these are other people's photographs, used
 * under licences that require attribution. If an item ever arrived without a
 * credit the gap would be visible here rather than quietly hidden.
 */
const Credit: React.FC<{ image: ApiMedia; className?: string; isArabic?: boolean }> = ({
  image,
  className = "",
  isArabic = false,
}) => (
  <p className={`text-[10px] font-mono text-brand-muted ${className}`}>
    {image.credit ?? "Credit missing"}
    {image.capturedAt ? ` · ${image.capturedAt}` : ""}
    {image.license ? ` · ${image.license}` : ""}
    {image.sourceUrl && (
      <>
        {" · "}
        <a
          href={image.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-brand-olive inline-flex items-center gap-0.5"
        >
          {isArabic ? "المصدر" : "source"}
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </>
    )}
  </p>
);

/**
 * Image gallery for a location, with a lightbox.
 *
 * Historical photographs are labelled as such: a plate from the 1840s and a
 * phone photo from 2019 tell you very different things about a place, and the
 * difference should not have to be guessed from the sepia.
 */
export const Gallery: React.FC<GalleryProps> = ({ images, loading }) => {
  const reduced = useReducedMotion();
  const { isArabic } = useInterfaceLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, number>>({});

  const imageSource = (image: ApiMedia, full = false) => {
    const failure = failedImages[image.id] ?? 0;
    if (failure >= 2) return null;
    const local = localMedia(image);
    if (failure === 0) return local ?? (full ? image.url : image.thumbUrl ?? image.url);
    const remote = full || !local ? image.url : image.thumbUrl ?? image.url;
    return remote !== local ? remote : null;
  };
  const markImageFailed = (image: ApiMedia) => setFailedImages((current) => ({
    ...current,
    [image.id]: Math.min(2, (current[image.id] ?? 0) + 1),
  }));

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  // Keyboard control for the lightbox: escape closes, arrows page through.
  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    // Stop the page behind the lightbox from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [openIndex, close, step]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <SkeletonLine key={index} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!images.length) {
    return (
      <p className="text-xs text-brand-muted font-serif italic">
        {isArabic ? "لم تُضف صور لهذا المكان بعد." : "No photographs have been added for this location yet."}
      </p>
    );
  }

  const open = openIndex === null ? null : images[openIndex];

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {images.map((image, index) => {
          const subject = isArabic ? (image.arabicSubject ?? image.subject) : image.subject;
          const description = isArabic ? (image.arabicDescription ?? image.description) : image.description;
          const source = imageSource(image);
          return (
          <motion.figure
            key={image.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-45px" }}
            transition={{ duration: reduced ? 0.15 : 0.4, delay: reduced ? 0 : (index % 3) * 0.065, ease: "easeOut" }}
            whileHover={reduced ? undefined : { y: -4, scale: 1.01 }}
            className="space-y-1.5 rounded-2xl border border-brand-border-light bg-white/80 p-2 shadow-sm transition-colors duration-300 hover:border-brand-amber/50 hover:bg-white hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="relative block w-full h-36 rounded-2xl overflow-hidden border border-brand-border bg-brand-olive group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber"
            >
              {source ? <img
                  src={source}
                  alt={description ?? subject ?? (isArabic ? "صورة تراثية" : "Heritage photograph")}
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                  onError={() => markImageFailed(image)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                /> : <span className="absolute inset-0 grid place-items-center p-4 text-center text-[10px] text-stone-200"><CameraOff className="w-6 h-6 mx-auto mb-1" />{isArabic ? "تعذر تحميل الصورة؛ يبقى الوصف والمصدر متاحين." : "Image unavailable; its description and source remain available."}</span>}
              {image.era && (
                <span className="absolute top-2 left-2 bg-white/90 text-brand-olive text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full">
                  {image.era === "historical"
                    ? (isArabic ? "تاريخية" : "Historical")
                    : (isArabic ? "حديثة" : "Modern")}
                </span>
              )}
            </button>
            {subject && (
              <figcaption className="text-[10px] font-serif font-bold text-brand-olive px-0.5">
                {subject}
              </figcaption>
            )}
            {description && (
              <p className="text-[10px] text-brand-text/75 leading-relaxed px-0.5 line-clamp-3">
                {description}
              </p>
            )}
            <Credit image={image} className="px-0.5 leading-snug" isArabic={isArabic} />
          </motion.figure>
        );})}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-brand-text/95 flex flex-col items-center justify-center p-4 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={(isArabic ? (open.arabicSubject ?? open.subject) : open.subject) ?? (isArabic ? "صورة" : "Photograph")}
            onClick={close}
          >
            <button
              type="button"
              onClick={close}
              aria-label={isArabic ? "إغلاق" : "Close"}
              className="absolute top-4 right-4 text-stone-200 hover:text-white p-2"
            >
              <X className="w-6 h-6" />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label={isArabic ? "الصورة السابقة" : "Previous photograph"}
                  onClick={(event) => {
                    event.stopPropagation();
                    step(-1);
                  }}
                  className="absolute left-2 sm:left-6 text-stone-200 hover:text-white p-2"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  type="button"
                  aria-label={isArabic ? "الصورة التالية" : "Next photograph"}
                  onClick={(event) => {
                    event.stopPropagation();
                    step(1);
                  }}
                  className="absolute right-2 sm:right-6 text-stone-200 hover:text-white p-2"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}

            <figure
              className="max-w-4xl w-full space-y-3"
              onClick={(event) => event.stopPropagation()}
            >
              {imageSource(open, true) ? <img
                  src={imageSource(open, true) ?? undefined}
                  alt={(isArabic ? (open.arabicDescription ?? open.description) : open.description) ?? open.subject ?? (isArabic ? "صورة تراثية" : "Heritage photograph")}
                  width={open.width}
                  height={open.height}
                  onError={() => markImageFailed(open)}
                  className="w-full max-h-[70vh] object-contain rounded-2xl"
                /> : <div className="min-h-64 rounded-2xl border border-white/15 grid place-items-center text-center text-stone-300 p-8"><div><CameraOff className="w-10 h-10 mx-auto mb-3" /><p className="text-sm">{isArabic ? "تعذر تحميل هذه الصورة من المصدر." : "This image could not be loaded from its source."}</p><button type="button" onClick={() => setFailedImages((current) => ({ ...current, [open.id]: 0 }))} className="mt-3 inline-flex items-center gap-1 text-xs text-brand-amber"><RefreshCw className="w-3 h-3" />{isArabic ? "أعد المحاولة" : "Retry"}</button></div></div>}
              <figcaption className="space-y-1 text-center">
                {(isArabic ? (open.arabicSubject ?? open.subject) : open.subject) && (
                  <p className="font-serif font-bold text-lg text-stone-100">
                    {isArabic ? (open.arabicSubject ?? open.subject) : open.subject}
                  </p>
                )}
                {(isArabic ? (open.arabicDescription ?? open.description) : open.description) && (
                  <p className="text-xs text-stone-300 leading-relaxed max-w-2xl mx-auto">
                    {isArabic ? (open.arabicDescription ?? open.description) : open.description}
                  </p>
                )}
                <Credit image={open} className="text-stone-400 pt-1" isArabic={isArabic} />
              </figcaption>
            </figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
