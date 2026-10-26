import React from "react";
import { useSearchParams } from "react-router-dom";
import { useLocations } from "../hooks/useLocations";
import { ContributionWizard } from "../components/ContributionWizard";
import { ContributionStatusLookup } from "../components/ContributionStatusLookup";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { LoadingRegion, SkeletonLine } from "../components/Skeleton";
import { PageTransition } from "../components/motion";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { Globe, Lock, ShieldCheck, Sparkles } from "lucide-react";

/**
 * Contribution page.
 *
 * `?location=<slug>` preselects a location, which is how the "Add yours" link
 * on a location page and the guide's "add what you know" prompt arrive here.
 */
export const ContributePage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const [searchParams] = useSearchParams();
  const { locations, loading, source, reason } = useLocations("all");

  return (
    <PageTransition>
      <div className="space-y-8">
        <DataSourceBanner source={source} reason={reason} />

        <div className="max-w-3xl">
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-brand-olive">
            {isArabic ? "اكتب حكايتك عن مكان" : "Write your story of a place"}
          </h1>
          <p className="text-base text-brand-text leading-relaxed mt-3">
            {isArabic ? "حكاية ليست سجلاً للمباني والتواريخ فقط. شارع مشيت فيه، أو دكان أُغلق، أو عبارة قالتها جدتك؛ كل ذلك تراث، وهو أول ما يضيع إن لم ندوّنه." : "Hikaya is not only a record of buildings and dates. A street you walked, a shop that closed, something your grandmother said — that is heritage too, and it is the part that disappears first if nobody writes it down."}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7">
            {loading ? (
              <>
                <SkeletonLine className="h-96 w-full rounded-3xl" />
                <LoadingRegion label={isArabic ? "جارٍ تحميل النموذج" : "Loading the form"} />
              </>
            ) : (
              <ContributionWizard
                locations={locations}
                defaultLocationId={searchParams.get("location") ?? undefined}
              />
            )}
          </div>

          <aside className="space-y-5 lg:col-span-5">
            <section className="rounded-3xl border border-brand-border bg-brand-surface p-6 space-y-4">
              <h2 className="font-serif text-xl font-black text-brand-olive">
                {isArabic ? "ماذا يحدث بعد الإرسال؟" : "What happens next?"}
              </h2>
              <ul className="space-y-4 text-sm leading-6 text-brand-muted">
                <li className="flex gap-3">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
                  {isArabic ? "في الخطوة الأخيرة تختار: تبقى الحكاية لك وحدك في جواز سفرك، أو تشاركها مع الجميع." : "At the last step you choose: keep the story just for you in your passport, or share it with everyone."}
                </li>
                <li className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
                  {isArabic ? "الحكايات العامة يراجعها مشرف قبل نشرها. تختار أن تُنشر باسمك أو أن تشارك الحكاية فقط دون أي معلومات عنك." : "An admin reviews every public story before it is published. You choose to publish it with your name, or share only the story and nothing about you."}
                </li>
                <li className="flex gap-3">
                  <Globe className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
                  {isArabic ? "الحكايات المعتمدة تظهر لكل الزوار في صفحة المكان ضمن قسم الذكريات." : "Approved stories appear for every visitor in the Memories section of the place page."}
                </li>
                <li className="flex gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
                  {isArabic ? "تتابع حالة حكايتك في جواز سفرك، أو برمز المتابعة من أي جهاز." : "Follow your story’s review in your passport, or with its reference code from any device."}
                </li>
              </ul>
            </section>
            <ContributionStatusLookup />
          </aside>
        </div>
      </div>
    </PageTransition>
  );
};
