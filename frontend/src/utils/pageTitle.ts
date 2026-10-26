import { governorateById, locationById } from "../data/heritage";

const SITE = { ar: "حكاية", en: "Hikaya" };

const STATIC: Record<string, { ar: string; en: string }> = {
  "/jerusalem": { ar: "القدس", en: "Jerusalem" },
  "/map": { ar: "خريطة القدس", en: "Jerusalem map" },
  "/palestine-map": { ar: "خريطة فلسطين", en: "Map of Palestine" },
  "/constellation": { ar: "روابط القدس", en: "Jerusalem connections" },
  "/palestine-connections": { ar: "روابط فلسطين", en: "Connections across Palestine" },
  "/create-story": { ar: "أنشئ حكايتك", en: "Create your story" },
  "/my-story": { ar: "حكايتي", en: "My story" },
  "/plan-tour": { ar: "خطط جولتك", en: "Plan your tour" },
  "/contribute": { ar: "شارك حكاية", en: "Share a memory" },
  "/about": { ar: "عن المنصة", en: "About" },
  "/account": { ar: "الحساب", en: "Account" },
  "/me": { ar: "جواز سفري", en: "My passport" },
};

/**
 * The browser-tab title for a route, so tabs, history and bookmarks say where
 * they lead instead of every page being "Hikaya | حكاية".
 */
export function pageTitle(pathname: string, isArabic: boolean): string {
  const site = isArabic ? SITE.ar : SITE.en;
  const name = (ar: string, en: string) => `${isArabic ? ar : en} · ${site}`;
  if (pathname === "/") return isArabic ? "حكاية · فلسطين تحكي" : "Hikaya · Palestine tells its stories";

  const fixed = STATIC[pathname];
  if (fixed) return name(fixed.ar, fixed.en);

  const place = pathname.match(/^\/locations\/([^/]+)(\/lesson)?/);
  if (place) {
    const location = locationById(decodeURIComponent(place[1]));
    if (!location) return name("مكان غير موجود", "Place not found");
    const arabic = location.arabicName ?? location.name;
    return place[2] ? name(`درس: ${arabic}`, `Lesson: ${location.name}`) : name(arabic, location.name);
  }

  const area = pathname.match(/^\/governorates\/([^/]+)(?:\/([^/]+))?/);
  if (area) {
    const governorate = governorateById(area[1]);
    if (!governorate) return name("الصفحة غير موجودة", "Page not found");
    const section = area[2] ? STATIC[`/${area[2] === "connections" ? "palestine-connections" : area[2]}`] : undefined;
    const label = { ar: governorate.arabicName, en: governorate.name };
    return section
      ? name(`${section.ar.replace(" فلسطين", "")} · ${label.ar}`, `${section.en.replace(/ (?:of|across) Palestine$/, "")} · ${label.en}`)
      : name(label.ar, label.en);
  }
  return site;
}
