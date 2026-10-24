import React from "react";
import { Award, ShieldCheck, GraduationCap } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";

const UNIVERSITIES = {
  birzeit: { ar: "جامعة بيرزيت", en: "Birzeit University" },
  ppu: { ar: "جامعة بوليتكنيك فلسطين", en: "Palestine Polytechnic University" },
  pau: { ar: "جامعة فلسطين الأهلية", en: "Palestine Ahliya University" },
};

type University = keyof typeof UNIVERSITIES;

const universityName = (id: University, isArabic: boolean) =>
  isArabic ? UNIVERSITIES[id].ar : UNIVERSITIES[id].en;

const TEAM_MEMBERS: { name: string; university: University }[] = [
  { name: "نور الدين اتكيدك", university: "birzeit" },
  { name: "دعاء حتو", university: "birzeit" },
  { name: "عمرة صوالحة", university: "ppu" },
  { name: "أروى حجاحجة", university: "ppu" },
  { name: "جود أبو عمر", university: "ppu" },
  { name: "تمارا حمدان", university: "pau" },
];

export const AboutPanel: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Narrative Intro Card */}
      <div className="relative bg-brand-olive text-brand-bg p-8 rounded-3xl overflow-hidden shadow-2xl border border-brand-olive">
        <div className="absolute inset-0 tatreez-grid pointer-events-none opacity-5" />
        <div className="relative z-10 space-y-4">
          <div className="inline-block bg-brand-amber/20 text-brand-amber text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-brand-amber/30">
            {isArabic ? "Hikaya" : "Hikaya"}
          </div>
          <h3 className="font-serif font-black text-3xl text-brand-amber">
            {isArabic ? "حكاية · دليل حي للتراث الفلسطيني" : "Hikaya · A Living Palestinian Heritage Guide"}
          </h3>
          <p className="text-stone-300 text-sm leading-relaxed italic">
            {isArabic ? "حكاية دليل شخصي مدعوم بالذكاء الاصطناعي وأرشيف حي يجمع القدس ورام الله والخليل وغزة. يجمع بين السرد الموثّق والمسارات التي تعمل دون اتصال والرواية الصوتية وصور الماضي والحاضر وذكريات المجتمع المراجعة." : "Hikaya is an AI-powered personal guide and living archive covering Jerusalem, Ramallah, Hebron and Gaza. It combines grounded storytelling, offline routing, narration, then-and-now photography and reviewed community memories."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-5 rounded-3xl border border-brand-border bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-amber">Official identity</p>
          <p className="mt-1 font-serif text-lg font-black text-brand-olive">Hikaya · حكاية</p>
          <p className="mt-1 text-xs leading-5 text-brand-muted">{isArabic ? "شعار حكاية الرسمي." : "Official Hikaya logo."}</p>
        </div>
        <img src="/logo-vertical.png" alt="Hikaya | حكاية" className="h-28 w-24 shrink-0 rounded-2xl object-contain mix-blend-multiply" />
      </div>

      {/* Grid of Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-brand-border p-6 rounded-2xl space-y-3 shadow-md">
          <div className="w-8 h-8 rounded-full bg-brand-olive text-brand-bg flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h4 className="font-serif font-black text-base text-brand-olive">
            {isArabic ? "إطار يمنع اختلاق المعلومات" : "Anti-Hallucination Framework"}
          </h4>
          <p className="text-xs text-brand-text leading-relaxed">
            {isArabic ? <>لا يصوغ الذكاء الاصطناعي إلا من مكتبة حكاية التحريرية المراجعة. يتحقق حارس الحقائق من الأسماء والتواريخ، وتبقى الروايات الدينية والشفوية منسوبة إلى مصادرها، ويظهر تنبيه صريح عند غياب المعلومة بدلاً من التخمين.</> : <>The AI can only synthesize Hikaya’s reviewed editorial library. Fact-guard checks names and dates, religious and oral traditions remain attributed, and uncovered questions return an explicit uncertainty note rather than a guess.</>}
          </p>
        </div>

        <div className="bg-white border border-brand-border p-6 rounded-2xl space-y-3 shadow-md">
          <div className="w-8 h-8 rounded-full bg-brand-amber text-white flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <h4 className="font-serif font-black text-base text-brand-olive">
            {isArabic ? "هوية بصرية فلسطينية" : "Palestinian-inspired visual identity"}
          </h4>
          <p className="text-xs text-brand-text leading-relaxed">
            {isArabic ? "تستمد الهوية البصرية ألوانها من الزيتون والحجر الجيري الدافئ في مدن فلسطين القديمة وتفاصيل التطريز الفلسطيني، مع خط «ثمانية» العربي في كامل الواجهة." : "The visual theme draws from olive groves, the warm limestone of Palestine’s old cities, and Palestinian tatreez details, with the Thmanyah type family used throughout the interface."}
          </p>
        </div>
      </div>

      {/* Team Profile */}
      <div className="border-t border-brand-border pt-6 space-y-4">
        <h4 className="font-serif font-black text-xl text-brand-olive">
          {isArabic ? "فريق التطوير" : "Development Team"}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 relative overflow-hidden bg-brand-olive text-brand-bg border border-brand-olive p-5 rounded-2xl shadow-md">
            <div className="absolute inset-0 tatreez-grid pointer-events-none opacity-5" />
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 shrink-0 rounded-full bg-brand-amber text-white flex items-center justify-center shadow-sm">
                <Award className="w-6 h-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-brand-amber/20 border border-brand-amber/30 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-brand-amber">
                  Team Lead
                </span>
                <p className="mt-2 font-serif font-black text-xl text-white">أوس حماد</p>
                <p className="mt-1 text-xs text-stone-300">{universityName("birzeit", isArabic)}</p>
              </div>
            </div>
          </div>

          {TEAM_MEMBERS.map((member) => (
            <div
              key={member.name}
              className="group bg-white border border-brand-border p-5 rounded-2xl shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-amber/60 hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 shrink-0 rounded-xl bg-brand-bg border border-brand-border text-brand-olive flex items-center justify-center transition-colors group-hover:bg-brand-amber group-hover:text-white group-hover:border-brand-amber">
                  <GraduationCap className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-serif font-black text-lg text-brand-olive leading-tight">{member.name}</p>
                  <p className="mt-1 text-xs font-bold text-brand-muted">
                    {universityName(member.university, isArabic)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          </div>
      </div>
    </div>
  );
};
