import React, { useState } from "react";
import {
  Camera,
  CameraOff,
  ExternalLink,
  HeartHandshake,
  MapPin,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { artisanHighlights, locationById } from "../locationsData";
import { useInterfaceLanguage } from "../context/LanguageContext";

export const LocalArtisansSection: React.FC<{ locationId: string }> = ({ locationId }) => {
  const { isArabic } = useInterfaceLanguage();
  const items = artisanHighlights.filter((item) => item.locationId === locationId);
  const neighbourhood = locationById(locationId);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  const categoryLabel = (category: string) => {
    if (isArabic) {
      if (!items.length) return <p className="text-xs text-brand-muted">{isArabic ? "لم تُضف سجلات حرف ودكاكين مراجعة لهذا المكان بعد." : "No reviewed craft or shop records have been added for this place yet."}</p>;

  return ({ food: "مأكولات محلية", craft: "حرفة مقدسية", market: "سوق ومجتمع" }[category] ?? category);
    }
    if (!items.length) return <p className="text-xs text-brand-muted">{isArabic ? "لم تُضف سجلات حرف ودكاكين مراجعة لهذا المكان بعد." : "No reviewed craft or shop records have been added for this place yet."}</p>;

  return ({ food: "Local food", craft: "Jerusalem craft", market: "Market & community" }[category] ?? category);
  };

  if (!items.length) return <p className="text-xs text-brand-muted">{isArabic ? "لم تُضف سجلات حرف ودكاكين مراجعة لهذا المكان بعد." : "No reviewed craft or shop records have been added for this place yet."}</p>;

  return (
    <section className="space-y-5" dir={isArabic ? "rtl" : "ltr"}>
      <div className="overflow-hidden rounded-3xl border border-brand-amber/30 bg-gradient-to-br from-brand-amber/10 via-brand-surface to-brand-olive/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-amber text-white shadow-sm">
            <HeartHandshake className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-brand-amber">
              {isArabic ? "وجوه القدس · الحرفة · السوق" : "People · craft · market"}
            </p>
            <h2 className="font-serif text-xl font-black text-brand-olive sm:text-2xl">
              {isArabic ? "دكاكين وحرف القدس" : "Jerusalem shops & crafts"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-brand-text">
              {isArabic
                ? "هذه صور موثّقة للمكان أو الحرفة الظاهرة فعلاً، وليست صوراً توليدية. يساعد الشراء المباشر من العائلات والتجار المقدسيين على بقاء الحرفة والسوق جزءاً حياً من الحي."
                : "These are documented photographs of the place or craft actually shown, not generated imagery. Buying directly from Jerusalemite families and merchants helps keep craft and market life rooted in the neighbourhood."}
            </p>
          </div>
        </div>
      </div>

      {items.length ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {items.map((item) => {
            const alt = isArabic ? item.arabicImageAlt : item.imageAlt;
            const locationNote = isArabic
              ? (item.arabicLocationNote ?? `في نطاق ${neighbourhood?.arabicName ?? "هذا الحي"}`)
              : (item.locationNote ?? `In and around ${neighbourhood?.name ?? "this neighbourhood"}`);

            if (!items.length) return <p className="text-xs text-brand-muted">{isArabic ? "لم تُضف سجلات حرف ودكاكين مراجعة لهذا المكان بعد." : "No reviewed craft or shop records have been added for this place yet."}</p>;

  return (
              <article
                key={item.id}
                className="group overflow-hidden rounded-3xl border border-brand-border bg-brand-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <figure className="relative aspect-[16/10] overflow-hidden bg-brand-olive/10">
                  {!failedImages.includes(item.id) ? <img
                    src={item.imageUrl}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      if (item.fallbackImageUrl && event.currentTarget.src !== new URL(item.fallbackImageUrl, window.location.href).href) {
                        event.currentTarget.src = item.fallbackImageUrl;
                      } else {
                        setFailedImages((current) => current.includes(item.id) ? current : [...current, item.id]);
                      }
                    }}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                  /> : <div className="absolute inset-0 grid place-items-center p-6 text-center text-xs text-brand-muted"><div><CameraOff className="w-7 h-7 mx-auto mb-2" />{isArabic ? "تعذر تحميل الصورة؛ معلومات الحرفة ومصدرها ما زالت متاحة." : "The image is unavailable; the craft information and source remain available."}</div></div>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" aria-hidden="true" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                    <figcaption className="max-w-[78%] text-xs font-medium leading-5 drop-shadow-sm">
                      {alt}
                    </figcaption>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/40 bg-black/25 backdrop-blur-sm">
                      <Camera className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </figure>

                <div className="space-y-3 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-brand-amber/10 px-3 py-1.5 text-brand-amber">
                      {item.category === "food" ? (
                        <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="font-mono text-xs font-bold uppercase tracking-wider">
                        {categoryLabel(item.category)}
                      </span>
                    </span>
                    <span className="rounded-full border border-brand-olive/15 bg-brand-olive/5 px-2.5 py-1 text-xs font-bold text-brand-olive">
                      {isArabic ? "دعم الاقتصاد المحلي المقدسي" : "Support Jerusalem’s local economy"}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-serif text-xl font-black text-brand-olive">
                      {isArabic ? item.arabicName : item.name}
                    </h3>
                    <p className="mt-1 text-xs text-brand-muted" dir={isArabic ? "ltr" : "rtl"}>
                      {isArabic ? item.name : item.arabicName}
                    </p>
                  </div>

                  <p className="text-sm leading-7 text-brand-text">
                    {isArabic ? item.arabicDescription : item.description}
                  </p>

                  <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-muted">
                    <MapPin className="h-3.5 w-3.5 text-brand-amber" aria-hidden="true" />
                    {locationNote}
                  </p>

                  <div className="rounded-2xl bg-brand-olive/5 p-3 text-xs leading-6 text-brand-olive">
                    <span className="font-bold">{isArabic ? "كيف تدعم أهل الحي: " : "How to support locally: "}</span>
                    {isArabic ? item.arabicSupportNote : item.supportNote}
                  </div>

                  <a
                    href={item.imageSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 border-t border-brand-border-light pt-3 text-xs text-brand-muted transition hover:text-brand-amber"
                    aria-label={`${isArabic ? "افتح مصدر الصورة" : "Open image source"}: ${item.imageCredit}`}
                  >
                    <span>
                      {isArabic ? "الصورة: " : "Photo: "}
                      <bdi>{item.imageCredit}</bdi>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <bdi>{item.imageLicense}</bdi>
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-brand-muted">
          {isArabic
            ? "لا توجد قائمة تجارية بالاسم لهذا الحي بعد؛ نتجنب اختلاق توصيات غير موثقة."
            : "No named business list has been reviewed for this location yet, so Hikaya does not invent recommendations."}
        </p>
      )}
    </section>
  );
};
