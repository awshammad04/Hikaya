import React, { useEffect, useState } from "react";
import { useLocations } from "../hooks/useLocations";
import { MemoryConstellation } from "../components/MemoryConstellation";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { LoadingRegion, SkeletonLine } from "../components/Skeleton";
import { PageTransition } from "../components/motion";
import { getContributions } from "../services/api";
import { ApiContribution } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { Link, useParams } from "react-router-dom";
import { PenLine } from "lucide-react";
import { locationById } from "../data/heritage";

/**
 * The archive as a web instead of a list.
 *
 * A flat list tells you little; the same places drawn with their shared
 * categories and attached memories shows where the archive is
 * dense and where it is thin - which is the more useful thing to know, and the
 * more honest picture of how much is still missing.
 */
export const ConstellationPage: React.FC<{scope?: string}> = ({scope}) => {
  const {governorateId}=useParams();
  const { isArabic } = useInterfaceLanguage();
  const { locations, loading, source, reason } = useLocations(scope ?? governorateId ?? "jerusalem");
  const [memories, setMemories] = useState<ApiContribution[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getContributions()
      .then((result) => {
        if (active) setMemories(result.data);
      })
      .finally(() => {
        if (active) setMemoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const busy = loading || memoriesLoading;
  const uncoveredLocations = locations.filter((location) =>
    !memories.some((memory) => memory.locationId === location.id),
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <DataSourceBanner source={source} reason={reason} />

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-amber">
            {isArabic ? "كوكبة الذاكرة" : "Memory constellation"}
          </p>
          <h1 className="mt-1 font-serif font-black text-3xl text-brand-olive">
            {isArabic ? "كيف تتصل الأماكن" : "How the places connect"}
          </h1>
          <p className="text-sm text-brand-text max-w-2xl mt-2 leading-relaxed">
            {isArabic ? "تجمع هذه الشبكة أماكن الأرشيف والموضوعات المشتركة والذكريات المرتبطة بها. تكشف المساحات الفارغة ما لم يُوثَّق بعد بوضوح لا يقل عن وضوح الروابط الموجودة." : "Every location in the archive, the themes they have in common, and the memories people have attached to them. The gaps are as informative as the lines: a site with nothing orbiting it is one nobody has written about yet."}
          </p>
        </div>

        {busy ? (
          <>
            <SkeletonLine className="h-[520px] w-full rounded-3xl" />
            <LoadingRegion label={isArabic ? "جارٍ رسم شبكة الذاكرة" : "Drawing the constellation"} />
          </>
        ) : (
          <>
            <MemoryConstellation locations={locations} memories={memories} />
            {uncoveredLocations.length > 0 && (
              <section className="rounded-3xl border border-brand-border bg-brand-surface p-5 sm:p-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-brand-amber font-bold">{isArabic ? "فجوات الذاكرة" : "Memory gaps"}</p>
                  <h2 className="font-serif font-black text-xl text-brand-olive">{isArabic ? "أماكن تنتظر ذكريات أهلها" : "Places waiting for community memories"}</h2>
                  <p className="text-xs text-brand-muted mt-1 max-w-2xl">{isArabic ? "لا نملأ هذه المساحات بنصوص مخترعة. إذا كانت لديك ذكرى شخصية من أحد هذه الأماكن، شاركها وسيحفظها فريق التوثيق بوصفها ذاكرة شفوية منسوبة لصاحبها." : "These spaces are not filled with invented copy. If you hold a personal memory of one of these places, submit it for review as clearly attributed oral heritage."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uncoveredLocations.map((location) => (
                    <Link key={location.id} to={`/contribute?location=${location.id}`} className="rounded-full border border-brand-border px-3 py-2 text-xs text-brand-olive hover:border-brand-amber inline-flex items-center gap-1.5">
                      <PenLine className="w-3 h-3 text-brand-amber" />
                      {isArabic ? (locationById(location.id)?.arabicName ?? location.arabicName ?? location.name) : location.name}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
};
