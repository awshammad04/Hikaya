export interface Governorate {
  id: string;
  slug: string;
  name: string;
  arabicName: string;
  description: string;
  arabicDescription: string;
  mapCenter: { latitude: number; longitude: number };
  mapZoom: number;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  coverImageUrl?: string;
}

export interface CatalogLocation {
  id: string;
  governorateId: string;
  name: string;
  arabicName: string;
  city: string;
  arabicCity: string;
  description: string;
  arabicDescription: string;
  facts: string;
  arabicFacts: string;
  traditions: string;
  arabicTraditions: string;
  latitude?: number;
  longitude?: number;
  coordinateStatus: string;
  categories: string[];
  interests: string[];
  reviewStatus: string;
  reviewed: boolean;
  sources: {
    title: string;
    arabicTitle: string;
    publisher: string;
    arabicPublisher: string;
    url: string;
  }[];
  timeline: {
    year: number;
    label: string;
    description: string;
    arabicDescription: string;
  }[];
  quiz: {
    question: string;
    arabicQuestion: string;
    options: string[];
    arabicOptions: string[];
    answerIndex: number;
  };
}

export interface PalestineCatalog {
  governorates: Governorate[];
  locations: CatalogLocation[];
  gaps: { en: string; ar: string };
}
