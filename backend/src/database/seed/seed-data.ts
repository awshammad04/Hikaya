import { Contribution } from '../entities/contribution.entity';
import { Location } from '../entities/location.entity';
import { Story } from '../entities/story.entity';

const GATE = 'https://commons.wikimedia.org/wiki/Special:FilePath/125307_jerusalem_-_nablus_gate_square_entrance_PikiWiki_Israel.jpg?width=1600';
const MUSLIM = 'https://commons.wikimedia.org/wiki/Special:FilePath/Souq_al-Qattanin_%D8%B3%D9%88%D9%82_%D8%A7%D9%84%D9%82%D8%B7%D8%A7%D9%86%D9%8A%D9%86_%D8%A7%D9%84%D9%82%D8%AF%D8%B3.jpg?width=1600';
const CHRISTIAN = 'https://commons.wikimedia.org/wiki/Special:FilePath/Christian_Quarter_IMG_0431.jpg?width=1600';
const ARMENIAN = 'https://commons.wikimedia.org/wiki/Special:FilePath/Entrance_to_the_Cathedral_of_Saint_James_in_the_Armenian_Quarter_of_Jerusalem.jpg?width=1600';
const MAGHARIBA = 'https://commons.wikimedia.org/wiki/Special:FilePath/19th_century_view_of_Jerusalem%2C_including_the_Moroccan_Quarter.jpg?width=1600';
const SHEIKH_JARRAH = 'https://commons.wikimedia.org/wiki/Special:FilePath/Kharufe_house_Sheikh_Jarrah.JPG?width=1600';
const SILWAN = 'https://commons.wikimedia.org/wiki/Special:FilePath/%D9%82%D8%B1%D9%8A%D8%A9_%D8%B3%D9%84%D9%88%D8%A7%D9%86.jpg?width=1600';
const AT_TUR = 'https://commons.wikimedia.org/wiki/Special:FilePath/Jerusalem_panorama_from_Mount_of_Olives.jpg?width=1600';

export const SEED_LOCATIONS: Location[] = [
  location('muslim-quarter', 'Muslim Quarter', 'حارة المسلمين', 31.7806, 35.2339, 'The Old City’s largest quarter, shaped by Mamluk architecture, living markets and routes leading toward Al-Aqsa.', MUSLIM, ['حارة تاريخية', 'معلم ديني', 'سوق تراثي']),
  location('christian-quarter', 'Christian Quarter', 'حارة النصارى', 31.7784, 35.2297, 'A quarter of churches, monasteries, hospices and markets centred on the Church of the Holy Sepulchre.', CHRISTIAN, ['حارة تاريخية', 'معلم ديني', 'سوق تراثي']),
  location('armenian-quarter', 'Armenian Quarter', 'حارة الأرمن', 31.7747, 35.2294, 'A compact historic quarter known for St James Cathedral, Armenian institutions and Jerusalem’s ceramic tradition.', ARMENIAN, ['حارة تاريخية', 'معلم ديني']),
  location('maghariba-quarter', 'Maghariba Quarter', 'حي وحارة المغاربة', 31.7755, 35.2338, 'The remembered Maghrebi Quarter beside Bab al-Maghariba and al-Buraq Wall, documented as an endowed urban community.', MAGHARIBA, ['حارة تاريخية', 'معلم ديني']),
  location('sheikh-jarrah', 'Sheikh Jarrah', 'حي الشيخ جراح', 31.7917, 35.2295, 'A Jerusalem neighbourhood known for historic villas, cultural institutions and steadfast family life.', SHEIKH_JARRAH, ['حي مقدسي']),
  location('silwan', 'Silwan', 'سلوان', 31.7707, 35.2368, 'A hillside Jerusalem neighbourhood tied to Ain Silwan, Wadi Hilweh, terraced gardens and oral memory.', SILWAN, ['حي مقدسي']),
  location('at-tur', 'At-Tur & Mount of Olives', 'الطور وجبل الزيتون', 31.7833, 35.2442, 'The eastern ridge: a living neighbourhood and landscape of panoramas, shrines, churches and cemeteries.', AT_TUR, ['حي مقدسي', 'معلم ديني']),
  location('bab-al-amud', 'Bab al-Amud', 'باب العامود ومحيطه', 31.7816, 35.2308, 'Jerusalem’s monumental northern gate and civic gathering place opening into Khan al-Zeit market.', GATE, ['حارة تاريخية', 'سوق تراثي']),
];

function location(id: string, name: string, arabicName: string, latitude: number, longitude: number, description: string, coverImageUrl: string, categories: string[]): Location {
  return { id, name, arabicName, city: 'Jerusalem', country: 'Palestine', latitude, longitude, description, coverImageUrl, contentFile: `content/ai-ready/${id}-summary.md`, aiSummaryFile: `content/ai-ready/${id}-summary.md`, categories, isPublished: true };
}

export const SEED_STORIES: Story[] = SEED_LOCATIONS.map((item) => ({
  id: `story-${item.id}`,
  locationId: item.id,
  authorId: 'user-editor',
  title: `${item.name}: a Jerusalem walk`,
  summary: item.description,
  originalContent: item.aiSummaryFile,
  simplifiedStory: `${item.name} (${item.arabicName}) is one of the eight focused Jerusalem places in Hikaya. ${item.description} Open the reviewed timeline, gallery and memories to follow what the documentation supports; where the record has a gap, the guide will not guess.`,
  audience: 'general', language: 'en', tone: 'storytelling', source: item.contentFile,
  isAiGenerated: false, uncertaintyNotes: [], status: 'published',
}));

export const SEED_CONTRIBUTIONS: Contribution[] = [
  memory('contribution-kaak', 'HQ-KAAK26', 'bab-al-amud', 'ذكريات كعك القدس عند باب العامود', 'أتذكر رائحة السمسم في الصباح، وبائع الكعك يحمل صينيته قرب الدرج. كانت الوقفة عند باب العامود بداية الطريق إلى السوق.'),
  memory('contribution-nabi-musa', 'HQ-MUSA26', 'muslim-quarter', 'من موسم النبي موسى', 'كانت العائلة تتحدث عن المواكب والأعلام والأناشيد التي تعبر طرق القدس في موسم النبي موسى. هذه ذاكرة عائلية مقدّمة بوصفها تراثاً شفوياً.'),
  memory('contribution-sadiyya', 'HQ-SAAD26', 'muslim-quarter', 'حكاية من حارة السعدية', 'صوت الأبواب الحجرية والجيران وهم يتبادلون الأطباق في رمضان هو ما بقي في ذاكرتي عن حارة السعدية.'),
  memory('contribution-silwan', 'HQ-SILW26', 'silwan', 'ماء العين وبساتين سلوان', 'تحكي جدتي عن الطريق إلى عين سلوان وعن سقاية الأشجار في البساتين. نسجلها هنا كذاكرة شخصية لا كإثبات تاريخي.'),
];

function memory(id: string, referenceCode: string, locationId: string, title: string, content: string): Contribution {
  return { id, referenceCode, locationId, userId: null, categoryId: 'cat-oral', title, content, contributorName: 'ذاكرة مقدسية', status: 'approved', reviewNotes: 'Published as attributed oral memory; not treated as verified historical fact.', reviewedAt: new Date('2026-09-20T00:00:00Z'), submittedAt: new Date('2026-09-18T00:00:00Z') };
}
