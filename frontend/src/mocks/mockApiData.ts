import { ApiContribution, ApiLocation, ApiStory, GeneratedStory, GuideAnswer } from "../types";
import { locations } from "../locationsData";
import { nationalRecord, catalog } from "../data/heritage";
import { visitorWalkthrough } from "../visitorWalkthroughs";
export { MOCK_MEDIA, MOCK_QUIZ, MOCK_TIMELINE } from "./generatedMockData";

export const MOCK_LOCATIONS: ApiLocation[] = locations.map((item) => ({
  id: item.id, name: item.name, arabicName: item.arabicName, city: "Jerusalem", country: "Palestine",
  latitude: item.lat, longitude: item.lng, description: item.summary, coverImageUrl: item.coverImage,
  contentFile: `content/ai-ready/${item.id}-summary.md`, aiSummaryFile: `content/ai-ready/${item.id}-summary.md`,
  categories: item.categories, isPublished: true,
}));

export const MOCK_STORIES: ApiStory[] = MOCK_LOCATIONS.map((item) => ({
  id: `story-${item.id}`, locationId: item.id, title: `${item.name}: a Jerusalem walk`, summary: item.description,
  simplifiedStory: `${item.name} (${item.arabicName}) is one of the eight focused Jerusalem places in Hikaya. ${item.description} Open the reviewed timeline, gallery and memories to follow what the documentation supports; where the record has a gap, the guide will not guess.`,
  audience: "general", language: "en", tone: "storytelling", source: item.contentFile,
  isAiGenerated: false, uncertaintyNotes: [], status: "published",
}));

export const MOCK_CONTRIBUTIONS: ApiContribution[] = [
  { id: "contribution-kaak", referenceCode: "HQ-KAAK26", locationId: "bab-al-amud", title: "ذكريات كعك القدس عند باب العامود", content: "أتذكر رائحة السمسم في الصباح، وبائع الكعك يحمل صينيته قرب الدرج. كانت الوقفة عند باب العامود بداية الطريق إلى السوق.", contributorName: "ذاكرة مقدسية", status: "approved", submittedAt: "2026-09-18T00:00:00.000Z" },
  { id: "contribution-nabi-musa", referenceCode: "HQ-MUSA26", locationId: "muslim-quarter", title: "من موسم النبي موسى", content: "كانت العائلة تتحدث عن المواكب والأعلام والأناشيد التي تعبر طرق القدس في موسم النبي موسى. هذه ذاكرة عائلية مقدّمة بوصفها تراثاً شفوياً.", contributorName: "ذاكرة مقدسية", status: "approved", submittedAt: "2026-09-18T00:00:00.000Z" },
  { id: "contribution-sadiyya", referenceCode: "HQ-SAAD26", locationId: "muslim-quarter", title: "حكاية من حارة السعدية", content: "صوت الأبواب الحجرية والجيران وهم يتبادلون الأطباق في رمضان هو ما بقي في ذاكرتي عن حارة السعدية.", contributorName: "ذاكرة مقدسية", status: "approved", submittedAt: "2026-09-18T00:00:00.000Z" },
  { id: "contribution-silwan", referenceCode: "HQ-SILW26", locationId: "silwan", title: "ماء العين وبساتين سلوان", content: "تحكي جدتي عن الطريق إلى عين سلوان وعن سقاية الأشجار في البساتين. نسجلها هنا كذاكرة شخصية لا كإثبات تاريخي.", contributorName: "ذاكرة مقدسية", status: "approved", submittedAt: "2026-09-18T00:00:00.000Z" },
];

export function mockGeneratedStory(location: ApiLocation, audience: string, language: "ar" | "en" = "en", tone = "storytelling"): GeneratedStory {
  const record = nationalRecord(location.id);
  if (record) {
    if (!record.reviewed || record.reviewStatus !== 'source_checked') throw new Error('Content is awaiting review.');
    const arabic = language === 'ar';
    const summary = arabic ? record.arabicDescription : record.description;
    const facts = arabic ? record.arabicFacts : record.facts;
    const tradition = arabic ? record.arabicTraditions : record.traditions;
    const importance = arabic ? record.arabicImportance : record.importance;
    const landmarks = arabic ? record.arabicLandmarks : record.landmarks;
    const walkthrough = arabic ? record.arabicWalkthrough : record.walkthrough;
    const gaps = arabic ? record.arabicGaps : record.gaps;
    const factsLabel = arabic ? 'حقائق موثقة' : 'Documented facts';
    const placeLabel = arabic ? 'قراءة المكان' : 'Reading the place';
    let narrative = [summary, walkthrough, importance, facts].filter(Boolean).join('\n\n');
    if (audience === 'short') {
      narrative = [summary, importance, facts]
        .filter(Boolean)
        .join(' ')
        .split(/(?<=[.!?؟])\s+/)
        .slice(0, 5)
        .join(' ');
    }
    if (audience === 'child') {
      narrative = arabic
        ? `هيا نكتشف هذا المتحف. ${summary}\n\n${placeLabel}\n${walkthrough}\n\n${importance}`
        : `Let us discover this museum. ${summary}\n\n${placeLabel}\n${walkthrough}\n\n${importance}`;
    }
    if (audience === 'student') {
      const landmarkList = Array.isArray(landmarks) && landmarks.length
        ? `\n\n${arabic ? 'عناصر موثقة في المكان' : 'Documented features'}\n- ${landmarks.join('\n- ')}`
        : '';
      narrative = `${arabic ? 'مدخل' : 'Overview'}\n${summary}\n\n${placeLabel}\n${walkthrough}\n\n${arabic ? 'لماذا يهمّ المتحف؟' : 'Why the museum matters'}\n${importance}${landmarkList}\n\n${factsLabel}\n${facts}`;
    }
    if (audience === 'tourist') {
      narrative = `${placeLabel}\n${walkthrough}\n\n${importance}`;
    }
    if (audience === 'historian') {
      narrative = `${arabic ? 'السجل الموثق' : 'Documented record'}\n${summary}\n\n${placeLabel}\n${walkthrough}\n\n${factsLabel}\n${facts}${tradition ? `\n\n${arabic ? 'تقليد ديني منسوب' : 'Attributed religious tradition'}\n${tradition}` : ''}\n\n${arabic ? 'حدود السجل' : 'Limits of the record'}\n${gaps}`;
    }
    const heading = tone === 'educational' ? (arabic ? 'قراءة السجل' : 'Reading the record') : tone === 'emotional' ? (arabic ? 'لحظة للتأمل' : 'A moment to reflect') : tone === 'storytelling' ? (arabic ? 'حكاية المكان' : 'The story of this place') : '';
    if (heading) narrative = `${heading}\n\n${narrative}`;
    return {title:arabic?record.arabicName:record.name,summary,narrative,targetAudience:audience,language,tone,wordCount:narrative.split(/\s+/).length,uncertaintyNotes:[gaps || (arabic?catalog.gaps.ar:catalog.gaps.en)],warnings:[],source:{locationId:location.id,locationName:location.name,contentFile:location.contentFile,summaryFile:location.aiSummaryFile},generatedBy:'frontend-mock'};
  }
  const profile = locations.find((item) => item.id === location.id);
  const walkthrough = visitorWalkthrough(location.id, language === "ar")
    ?? (language === "ar" ? profile?.arabicStory : profile?.story)
    ?? location.description
    ?? "";
  const name = language === "ar" ? (profile?.arabicName ?? location.arabicName ?? location.name) : location.name;
  const summary = language === "ar" ? (profile?.arabicSummary ?? location.description ?? name) : (profile?.summary ?? location.description ?? name);
  const history = language === "ar" ? (profile?.arabicHistoricalSummary ?? summary) : (profile?.historicalSummary ?? summary);
  const importance = language === "ar" ? (profile?.arabicCulturalImportance ?? summary) : (profile?.culturalImportance ?? summary);
  const landmarks = language === "ar" ? (profile?.arabicLandmarks ?? []) : (profile?.landmarks ?? []);
  let narrative = walkthrough;
  if (audience === "student") narrative = language === "ar"
    ? `مدخل\n${summary}\n\nالتسلسل التاريخي والسبب والنتيجة\n${history}\n\nقراءة المكان\n${walkthrough}\n\nخلاصة التعلّم\nاربط بين ما تراه وبين ${landmarks.join("، ")}، وميّز بين التاريخ الموثق والذاكرة الشفوية.`
    : `Introduction\n${summary}\n\nHistorical cause and sequence\n${history}\n\nReading the place\n${walkthrough}\n\nLearning takeaway\nConnect what you see with ${landmarks.join(", ")}, and keep documented history distinct from attributed oral memory.`;
  if (audience === "child") narrative = language === "ar"
    ? `هيا نكتشف ${name}. ${summary}\n\nتخيّل ملمس الحجر تحت يدك وأصوات الخطوات في الزقاق. ${importance}\n\nابحث بعينيك عن ${landmarks.slice(0, 3).join("، و")}. تحرّك بهدوء، فهذا المكان بيتٌ لأناس يعيشون فيه كل يوم.`
    : `Let us explore ${name}. ${summary}\n\nImagine the cool stone beside your hand and the footsteps moving through the lane. ${importance}\n\nCan you spot ${landmarks.slice(0, 3).join(", and ")}? Walk gently and remember that this heritage place is also someone’s everyday neighbourhood.`;
  if (audience === "historian") narrative = language === "ar"
    ? `الإطار الزمني\n${history}\n\nالأدلة المكانية والعمرانية\n${walkthrough}\n\nالسياق الاجتماعي والثقافي\n${importance}\n\nحدود السجل\nهذه صياغة استخراجية من السجل المراجع؛ لا تستكمل الفجوات بادعاءات غير موثقة.`
    : `Chronology\n${history}\n\nSpatial and architectural evidence\n${walkthrough}\n\nSocial and cultural context\n${importance}\n\nLimits of the record\nThis extractive account uses only the reviewed place record and does not fill evidentiary gaps.`;
  if (audience === "short") narrative = [summary, history, importance]
    .flatMap((text) => text.split(/(?<=[.!?؟])/).map((sentence) => sentence.trim()).filter(Boolean))
    .slice(0, 5)
    .join(" ");
  if (audience === "general") narrative = `${language === "ar" ? profile?.arabicStory ?? summary : profile?.story ?? summary}\n\n${walkthrough}`;
  return { title: language === "ar" && profile ? profile.arabicStoryTitle : location.name, summary: language === "ar" && profile ? profile.arabicSummary : (location.description ?? location.name), narrative, targetAudience: audience, language, tone: "storytelling", wordCount: narrative.split(/\s+/).length, uncertaintyNotes: [language === "ar" ? "استجابة استخراجية دون اتصال؛ لم تُضف أي حقائق خارج سجل المكان المراجع." : "Offline extractive response: no facts were added beyond the stored reviewed location record."], warnings: [], source: { locationId: location.id, locationName: location.name, contentFile: location.contentFile, summaryFile: location.aiSummaryFile }, generatedBy: "frontend-mock" };
}

export function mockGuideAnswer(locationId: string, question: string, language: "ar" | "en" = "en"): GuideAnswer {
  const location = MOCK_LOCATIONS.find((item) => item.id === locationId);
  if (language === "ar") return { answer: "لا يستطيع الدليل دون اتصال البحث في كامل السجل المراجع الآن، لذلك لم يخمّن إجابة.", answeredFromSource: false, excerpts: [], uncertaintyNotes: [`لم يُجب وضع عدم الاتصال عن: «${question.trim()}».`], generatedBy: "frontend-mock" };
  return { answer: `The offline guide cannot search the full reviewed record for ${location?.name ?? "this location"}. It has not guessed an answer.`, answeredFromSource: false, excerpts: [], uncertaintyNotes: [`Offline: “${question.trim()}” was not answered because source retrieval is unavailable.`], generatedBy: "frontend-mock" };
}
