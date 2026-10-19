import { nationalRecord } from "./data/heritage";

export interface SourceCitation {
  title: string;
  arabicTitle: string;
  publisher: string;
  arabicPublisher: string;
  url: string;
}

const BILADUNA: SourceCitation = {
  title: "Palestine, Our Homeland (Biladuna Filastin), Jerusalem district",
  arabicTitle: "بلادنا فلسطين، ديار بيت المقدس",
  publisher: "Mustafa Murad al-Dabbagh · Institute for Palestine Studies",
  arabicPublisher: "مصطفى مراد الدباغ · مؤسسة الدراسات الفلسطينية",
  url: "https://www.palestine-studies.org/en/node/1648296/1000",
};

const PASSIA_OLD_CITY: SourceCitation = {
  title: "The Old City, 1944 & 1966",
  arabicTitle: "البلدة القديمة، 1944 و1966",
  publisher: "PASSIA · Palestinian Academic Society for the Study of International Affairs",
  arabicPublisher: "باسيا · الجمعية الفلسطينية الأكاديمية للشؤون الدولية",
  url: "https://maps.passia.org/the-old-city-1944-1966/",
};

const SOURCES: Record<string, SourceCitation[]> = {
  "muslim-quarter": [
    {
      title: "Suq al-Qattanin architectural record",
      arabicTitle: "السجل المعماري لسوق القطانين",
      publisher: "Museum With No Frontiers · Discover Islamic Art",
      arabicPublisher: "متحف بلا حدود · اكتشف الفن الإسلامي",
      url: "https://islamicart.museumwnf.org/database_item.php?id=monuments%3BISL%3Bpa%3BMon01%3B6%3Ben",
    },
    {
      title: "Khan Tankaz and the Mamluk market complex",
      arabicTitle: "خان تنكز ومجمّع السوق المملوكي",
      publisher: "Al-Quds University · Jerusalem Studies",
      arabicPublisher: "جامعة القدس · دراسات القدس",
      url: "https://jerusalem-studies.alquds.edu/en/jerusalem/khan-tankaz.html",
    },
    PASSIA_OLD_CITY,
  ],
  "christian-quarter": [
    {
      title: "Music-Making in the Heart of the Christian Quarter",
      arabicTitle: "صناعة الموسيقى في قلب حارة النصارى",
      publisher: "Jerusalem Quarterly · Institute for Palestine Studies",
      arabicPublisher: "حوليات القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/en/journals/explorer?f%5B0%5D=field_digital_sections%3A3242&f%5B1%5D=field_is_fulltext_filled_interna%3A1",
    },
    {
      title: "Church of the Holy Sepulchre",
      arabicTitle: "كنيسة القيامة: سجل تاريخي ومعماري",
      publisher: "Oxford Reference",
      arabicPublisher: "مرجع أكسفورد الأكاديمي",
      url: "https://academic.oup.com/reference/62384/reference-article-abstract/555074927",
    },
    PASSIA_OLD_CITY,
  ],
  "armenian-quarter": [
    {
      title: "Fifteen Centuries and Still Counting—the Old City Armenians",
      arabicTitle: "خمسة عشر قرناً وما زال العد مستمراً: أرمن البلدة القديمة",
      publisher: "Jerusalem Quarterly · Institute for Palestine Studies",
      arabicPublisher: "حوليات القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/sites/default/files/jq-articles/9_fifteen_centuries_1_0.pdf",
    },
    {
      title: "The Battle for Armenian Jerusalem",
      arabicTitle: "معركة القدس الأرمنية",
      publisher: "Jerusalem Quarterly · Institute for Palestine Studies",
      arabicPublisher: "حوليات القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/sites/default/files/jq-articles/The%20Battle%20for%20Armenian%20Jerusalem.pdf",
    },
    BILADUNA,
  ],
  "maghariba-quarter": [
    {
      title: "The Moroccan Quarter and its Waqf",
      arabicTitle: "حارة المغاربة ووقفها",
      publisher: "PASSIA Historical Records",
      arabicPublisher: "باسيا · السجلات التاريخية الفلسطينية",
      url: "https://passia.org/media/filer_public/a9/8d/a98d60b9-5db2-4a23-86e6-d64e8f02fd0d/waqf_book_english_-_final.pdf",
    },
    {
      title: "Jerusalem 1967: Palestinian municipal and religious records",
      arabicTitle: "القدس 1967: وثائق البلدية والمؤسسة الدينية الفلسطينية",
      publisher: "Journal of Palestine Studies · Institute for Palestine Studies",
      arabicPublisher: "مجلة الدراسات الفلسطينية · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/sites/default/files/attachments/jps-articles/jps.2007.37.1.88.pdf",
    },
    {
      title: "The Moroccan Quarter: A History of the Present",
      arabicTitle: "حارة المغاربة: تاريخ الحاضر",
      publisher: "Jerusalem Quarterly · Institute for Palestine Studies",
      arabicPublisher: "حوليات القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/sites/default/files/jq-articles/7_the_moroccan_2_0.pdf",
    },
  ],
  "sheikh-jarrah": [
    {
      title: "Isaf al-Nashashibi House: architectural and cultural history",
      arabicTitle: "بيت إسعاف النشاشيبي: تاريخ معماري وثقافي",
      publisher: "Jerusalem Quarterly · Institute for Palestine Studies",
      arabicPublisher: "حوليات القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/sites/default/files/jq-articles/JQ%2086%20cross%20oct%2018.pdf",
    },
    {
      title: "1954 housing agreement record",
      arabicTitle: "سجل اتفاق الإسكان لعام 1954",
      publisher: "United Nations Information System on Palestine",
      arabicPublisher: "نظام معلومات الأمم المتحدة بشأن قضية فلسطين",
      url: "https://www.un.org/unispal/document/auto-insert-178254/",
    },
    {
      title: "Jerusalem neighbourhoods and villages: Sheikh Jarrah",
      arabicTitle: "أحياء وقرى القدس: الشيخ جراح",
      publisher: "Jerusalem Platform · Institute for Palestine Studies",
      arabicPublisher: "منصة القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://documentjerusalem.palestine-studies.org/en/Locaities_villages",
    },
  ],
  silwan: [
    {
      title: "Urban Design, Narrative and Archaeology in Silwan",
      arabicTitle: "إعادة تصميم سلوان: المشهد والرواية وعلم الآثار",
      publisher: "Jerusalem Quarterly · Institute for Palestine Studies",
      arabicPublisher: "حوليات القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/sites/default/files/jq-articles/39_Pullan_City_of_David_0.pdf",
    },
    {
      title: "Jerusalem neighbourhoods and villages: Silwan",
      arabicTitle: "أحياء وقرى القدس: سلوان",
      publisher: "Jerusalem Platform · Institute for Palestine Studies",
      arabicPublisher: "منصة القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://documentjerusalem.palestine-studies.org/en/Locaities_villages",
    },
    BILADUNA,
  ],
  "at-tur": [
    {
      title: "Jerusalem neighbourhoods and villages: At-Tur / Mount of Olives",
      arabicTitle: "أحياء وقرى القدس: الطور وجبل الزيتون",
      publisher: "Jerusalem Platform · Institute for Palestine Studies",
      arabicPublisher: "منصة القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://documentjerusalem.palestine-studies.org/en/Locaities_villages",
    },
    {
      title: "Gethsemane: Basilica of the Agony",
      arabicTitle: "الجثمانية: كنيسة النزاع",
      publisher: "Custody of the Holy Land",
      arabicPublisher: "حراسة الأراضي المقدسة",
      url: "https://www.custodia.org/en/sanctuaries/gethsemane-basilica-agony/",
    },
    BILADUNA,
  ],
  "bab-al-amud": [
    {
      title: "Bab al-Amud and the Palestinian public space",
      arabicTitle: "باب العامود والفضاء العام الفلسطيني",
      publisher: "Jerusalem Quarterly 77 · Institute for Palestine Studies",
      arabicPublisher: "حوليات القدس 77 · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/sites/default/files/jqpdf/JQ%2077%20-%20Full%20Issue%20with%20Covers_0.pdf",
    },
    {
      title: "Reflections of a Returning Daughter of Jerusalem",
      arabicTitle: "تأملات ابنة مقدسية عائدة",
      publisher: "Jerusalem Quarterly · Institute for Palestine Studies",
      arabicPublisher: "حوليات القدس · مؤسسة الدراسات الفلسطينية",
      url: "https://www.palestine-studies.org/sites/default/files/jq-articles/Reflections%20of%20a%20Returning%20Daughter%20of%20Jerusalem.pdf",
    },
    PASSIA_OLD_CITY,
  ],
};

function locationFromInternalId(value?: string | null) {
  if (!value) return undefined;
  if (SOURCES[value]) return value;
  return value.match(/(?:ai-ready\/)?([a-z0-9-]+)-summary\.md/i)?.[1];
}

export function sourceCitations(sourceId?: string | null, locationId?: string | null): SourceCitation[] {
  const national = nationalRecord(locationId ?? locationFromInternalId(sourceId) ?? "");
  if (national) return national.sources;
  const resolved = locationId && SOURCES[locationId] ? locationId : locationFromInternalId(sourceId);
  // Unknown internal IDs never reach the screen. A general Palestinian
  // bibliography is safer and more useful than exposing a repository path.
  return resolved && SOURCES[resolved] ? SOURCES[resolved] : [BILADUNA, PASSIA_OLD_CITY];
}

export function primarySourceTitle(
  sourceId: string | null | undefined,
  locationId: string | null | undefined,
  arabic: boolean,
) {
  const citation = sourceCitations(sourceId, locationId)[0];
  return arabic
    ? `${citation.arabicTitle} — ${citation.arabicPublisher}`
    : `${citation.title} — ${citation.publisher}`;
}
