import React, { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocations } from "../hooks/useLocations";
import { ContributionWizard, type ContributionDraft } from "../components/ContributionWizard";
import { InterviewKit } from "../components/InterviewKit";
import { ContributionStatusLookup } from "../components/ContributionStatusLookup";
import { DataSourceBanner } from "../components/DataSourceBanner";
import { LoadingRegion, SkeletonLine } from "../components/Skeleton";
import { PageTransition } from "../components/motion";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { Clock, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";

/**
 * Contribution page.
 *
 * `?location=<slug>` preselects a location, which is how the "Add yours" link
 * on a location page and the guide's "add what you know" prompt arrive here.
 * `?interview=1` opens the guided interview for recording an elder's memory.
 */
export const ContributePage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const [searchParams] = useSearchParams();
  const { locations, loading, source, reason } = useLocations("all");
  const [interviewOpen, setInterviewOpen] = useState(searchParams.get("interview") === "1");
  const [draft, setDraft] = useState<ContributionDraft | null>(null);
  const wizardRef = useRef<HTMLDivElement>(null);

  return (
    <PageTransition>
      <div className="space-y-8">
        <DataSourceBanner source={source} reason={reason} />

        <div className="max-w-3xl print:hidden">
          <h1 className="font-serif font-black text-3xl sm:text-4xl text-brand-olive">
            {isArabic ? "شارك ذكرى من فلسطين" : "Share a memory"}
          </h1>
          <p className="text-base text-brand-text leading-relaxed mt-3">
            {isArabic ? "حكاية ليست سجلاً للمباني والتواريخ فقط. شارع مشيت فيه، أو دكان أُغلق، أو عبارة قالتها جدتك؛ كل ذلك تراث، وهو أول ما يضيع إن لم ندوّنه." : "Hikaya is not only a record of buildings and dates. A street you walked, a shop that closed, something your grandmother said — that is heritage too, and it is the part that disappears first if nobody writes it down."}
          </p>
          {!interviewOpen && (
            <button
              type="button"
              onClick={() => setInterviewOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-amber/50 bg-brand-amber/10 px-5 py-2.5 text-sm font-bold text-brand-olive hover:bg-brand-amber/20"
            >
              <HeartHandshake className="h-4 w-4 text-brand-amber" />
              {isArabic ? "الذكرى عند جدتك أو جدك؟ استخدم دليل المقابلة" : "Is the memory your grandparent's? Use the interview guide"}
            </button>
          )}
        </div>

        {interviewOpen && !loading && (
          <InterviewKit
            locations={locations}
            defaultLocationId={searchParams.get("location") ?? undefined}
            onUseNotes={(next) => {
              setDraft(next);
              wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        )}

        <div className="grid gap-8 lg:grid-cols-12 lg:items-start print:hidden">
          <div className="lg:col-span-7 scroll-mt-24" ref={wizardRef}>
            {loading ? (
              <>
                <SkeletonLine className="h-96 w-full rounded-3xl" />
                <LoadingRegion label={isArabic ? "جارٍ تحميل النموذج" : "Loading the form"} />
              </>
            ) : (
              <ContributionWizard
                locations={locations}
                defaultLocationId={searchParams.get("location") ?? undefined}
                draft={draft}
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
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
                  {isArabic ? "يراجع فريق التوثيق كل ذكرى قبل نشرها. الاسم اختياري؛ اتركه فارغاً لتبقى مجهولاً." : "The documentation team reviews every memory before publishing. Your name is optional; leave it blank to stay anonymous."}
                </li>
                <li className="flex gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
                  {isArabic ? "تحصل على رمز متابعة لتعرف حالة ذكراك في أي وقت." : "You get a tracking code to check on your memory at any time."}
                </li>
                <li className="flex gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
                  {isArabic ? "الذكريات المعتمدة تظهر في صفحة المكان ضمن قسم الذكريات." : "Approved memories appear in the Memories section of the place page."}
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
