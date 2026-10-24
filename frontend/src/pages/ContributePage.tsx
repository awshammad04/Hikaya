import React from "react";
import { useSearchParams } from "react-router-dom";
import { useLocations } from "../hooks/useLocations";
import { ContributionWizard } from "../components/ContributionWizard";
import { ContributionStatusLookup } from "../components/ContributionStatusLookup";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { LoadingRegion, SkeletonLine } from "../components/Skeleton";
import { PageTransition } from "../components/motion";
import { useInterfaceLanguage } from "../context/LanguageContext";

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
      <div className="space-y-8 max-w-3xl">
        <DataSourceBanner source={source} reason={reason} />

        <div>
          <h1 className="font-serif font-black text-3xl text-brand-olive">
            {isArabic ? "شارك ذكرى" : "Share a memory"}
          </h1>
          <p className="text-sm text-brand-text leading-relaxed mt-2">
            {isArabic ? "حكاية ليست سجلاً للمباني والتواريخ فقط. شارع مشيت فيه، أو دكان أُغلق، أو عبارة قالتها جدتك؛ كل ذلك تراث، وهو أول ما يضيع إن لم ندوّنه." : "Hikaya is not only a record of buildings and dates. A street you walked, a shop that closed, something your grandmother said — that is heritage too, and it is the part that disappears first if nobody writes it down."}
          </p>
        </div>

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

        <ContributionStatusLookup />
      </div>
    </PageTransition>
  );
};
