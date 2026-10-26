import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BookHeart, ChevronDown, Home, Info, Languages, MapPin, Menu, Moon, PenLine, ShieldCheck, Stamp, Sun, Waypoints, X } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { MyJerusalemStoryModal } from "./MyJerusalemStoryModal";
import { governorates, governorateById, nationalRecord } from "../data/heritage";
import { OPEN_JERUSALEM_STORY_EVENT } from "../services/progress";
import { AccountChip, AccountToasts, ReviewChip, usePendingReviews } from "./AccountWidgets";

type Theme = "light" | "dark";
const THEME_KEY = "hikaya.theme";

function readStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Light/dark preference; follows the system until the visitor picks one. */
function useTheme(): [Theme, () => void] {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const update = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (stored) document.documentElement.dataset.theme = stored;
    else delete document.documentElement.dataset.theme;
  }, [stored]);

  const theme = stored ?? system;
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setStored(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private windows may block storage; the choice still applies this visit.
    }
  };
  return [theme, toggle];
}

/** The governorate a page belongs to, when it belongs to one. */
function currentGovernorate(pathname: string): string | null {
  const match = pathname.match(/^\/governorates\/([^/]+)/);
  if (match) return match[1];
  if (["/jerusalem", "/map", "/plan-tour", "/constellation"].includes(pathname)) return "jerusalem";
  if (pathname.startsWith("/locations/")) {
    return nationalRecord(pathname.split("/")[2])?.governorateId ?? "jerusalem";
  }
  return null;
}

export const AppLayout: React.FC = () => {
  const { language, setLanguage, isArabic } = useInterfaceLanguage();
  const [theme, toggleTheme] = useTheme();
  const [storyOpen, setStoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const placesRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  const governorateId = currentGovernorate(pathname);
  const isJerusalem = governorateId === "jerusalem";
  const governorate = governorateId ? governorateById(governorateId) : undefined;

  // Labels stay the same everywhere; inside Jerusalem the map and connections
  // open the Jerusalem versions.
  const pendingReviews = usePendingReviews();
  const navItems = [
    { to: "/", en: "Home", ar: "الرئيسية", icon: Home, active: pathname === "/" },
    {
      to: isJerusalem ? "/map" : "/palestine-map",
      en: "Map",
      ar: "الخريطة",
      icon: MapPin,
      active: pathname === "/map" || pathname === "/palestine-map" || /^\/governorates\/[^/]+\/map$/.test(pathname),
    },
    {
      to: isJerusalem ? "/constellation" : "/palestine-connections",
      en: "Connections",
      ar: "الروابط",
      icon: Waypoints,
      active: pathname === "/constellation" || pathname === "/palestine-connections" || /^\/governorates\/[^/]+\/connections$/.test(pathname),
    },
    { to: "/contribute", en: "Contribute", ar: "شارك حكاية", icon: PenLine, active: pathname === "/contribute" },
    { to: "/about", en: "About", ar: "عن المنصة", icon: Info, active: pathname === "/about" },
  ];
  const storyPath = governorateId ? `/governorates/${governorateId}/create-story` : "/create-story";
  const storyActive = pathname === "/create-story" || pathname === "/my-story" || pathname.endsWith("/create-story");

  useEffect(() => {
    const openStory = () => setStoryOpen(true);
    window.addEventListener(OPEN_JERUSALEM_STORY_EVENT, openStory);
    return () => window.removeEventListener(OPEN_JERUSALEM_STORY_EVENT, openStory);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setPlacesOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!placesOpen && !menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlacesOpen(false);
        setMenuOpen(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (placesRef.current && !placesRef.current.contains(event.target as Node)) setPlacesOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [placesOpen, menuOpen]);

  const navLinkClass = (active: boolean) =>
    `relative inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold transition-colors ${
      active ? "bg-brand-olive/10 text-brand-olive" : "text-brand-muted hover:bg-brand-olive/5 hover:text-brand-olive"
    }`;
  const storyButton =
    "h-10 items-center gap-2 rounded-full bg-brand-olive px-4 text-sm font-bold text-white transition-colors hover:bg-brand-olive-deep";
  const mobileStoryButton =
    "mt-4 flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl bg-brand-olive text-base font-bold text-white sm:hidden";
  const iconButton =
    "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-brand-border bg-brand-surface px-3 text-xs font-bold text-brand-olive transition-colors hover:border-brand-olive";

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-col" dir={isArabic ? "rtl" : "ltr"}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-[60] focus:rounded-full focus:bg-brand-olive focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        {isArabic ? "تخطَّ إلى المحتوى" : "Skip to content"}
      </a>
      <header className="sticky top-0 z-40 border-b border-brand-border-light bg-brand-bg/90 backdrop-blur-md">
        <div className="h-1 w-full bg-gradient-to-r from-brand-olive via-brand-amber to-brand-olive" />
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label={isArabic ? "حكاية — الرئيسية" : "Hikaya — home"}>
            <picture className="shrink-0 mix-blend-multiply dark:mix-blend-normal dark:rounded-xl dark:bg-[#f5f5f0] dark:p-0.5">
              <source media="(max-width: 520px)" srcSet="/logo-icon.png" />
              <img src="/logo-horizontal.png" alt="" className="h-11 w-auto max-w-[130px] rounded-lg object-contain" />
            </picture>
            <span className="hidden xl:block h-8 w-px shrink-0 bg-brand-border-light" aria-hidden="true" />
            <span className="hidden xl:block max-w-[12rem] text-xs leading-snug text-brand-muted">
              {isJerusalem
                ? isArabic ? "المرشد الرقمي الذكي للقدس" : "The intelligent guide to Jerusalem"
                : isArabic ? "المرشد الرقمي للتراث الفلسطيني" : "The digital guide to Palestinian heritage"}
            </span>
          </Link>

          <nav aria-label={isArabic ? "التنقل الرئيسي" : "Main"} className="hidden lg:flex items-center gap-1">
            {navItems.slice(0, 1).map(({ to, en, ar, icon: Icon, active }) => (
              <Link key={to} to={to} className={navLinkClass(active)} aria-current={active ? "page" : undefined}>
                <Icon className="hidden xl:block w-4 h-4" /> {isArabic ? ar : en}
              </Link>
            ))}
            <div className="relative" ref={placesRef}>
              <button
                type="button"
                onClick={() => setPlacesOpen((open) => !open)}
                aria-expanded={placesOpen}
                aria-haspopup="true"
                className={navLinkClass(Boolean(governorate))}
              >
                {governorate ? (isArabic ? governorate.arabicName : governorate.name) : isArabic ? "المحافظات" : "Governorates"}
                <ChevronDown className={`w-4 h-4 transition-transform ${placesOpen ? "rotate-180" : ""}`} />
              </button>
              {placesOpen && (
                <div className="absolute top-12 start-0 w-56 rounded-2xl border border-brand-border bg-brand-surface p-2 shadow-xl">
                  {governorates.map((item) => (
                    <NavLink
                      key={item.id}
                      to={`/governorates/${item.id}`}
                      className={() =>
                        `flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                          governorateId === item.id ? "bg-brand-olive/10 text-brand-olive" : "text-brand-text hover:bg-brand-bg"
                        }`
                      }
                    >
                      {isArabic ? item.arabicName : item.name}
                      <MapPin className="w-3.5 h-3.5 text-brand-amber" />
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
            {navItems.slice(1).map(({ to, en, ar, icon: Icon, active }) => (
              <Link key={to} to={to} className={navLinkClass(active)} aria-current={active ? "page" : undefined}>
                <Icon className="hidden xl:block w-4 h-4" /> {isArabic ? ar : en}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              aria-label={isArabic ? "التبديل إلى الإنجليزية" : "Switch to Arabic"}
              className={iconButton}
            >
              <Languages className="w-4 h-4" /> {language === "ar" ? "EN" : "ع"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? (isArabic ? "الوضع الفاتح" : "Light mode") : isArabic ? "الوضع الداكن" : "Dark mode"}
              className={`${iconButton} px-0`}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <ReviewChip pending={pendingReviews} />
            <AccountChip />
            {isJerusalem ? (
              <button type="button" onClick={() => setStoryOpen(true)} className={`hidden sm:inline-flex ${storyButton}`}>
                <BookHeart className="w-4 h-4 text-brand-amber-light" />
                {isArabic ? "أنشئ حكايتك" : "Create your story"}
              </button>
            ) : (
              <Link to={storyPath} className={`hidden sm:inline-flex ${storyButton} ${storyActive ? "ring-2 ring-brand-amber ring-offset-2 ring-offset-brand-bg" : ""}`}>
                <BookHeart className="w-4 h-4 text-brand-amber-light" />
                {isArabic ? "أنشئ حكايتك" : "Create your story"}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? (isArabic ? "إغلاق القائمة" : "Close menu") : isArabic ? "فتح القائمة" : "Open menu"}
              className={`${iconButton} px-0 lg:hidden`}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div id="mobile-menu" className="lg:hidden max-h-[calc(100dvh-4.25rem)] overflow-y-auto border-t border-brand-border-light bg-brand-bg px-4 pb-5 pt-3 sm:px-6">
            <nav aria-label={isArabic ? "التنقل الرئيسي" : "Main"} className="grid gap-1">
              {navItems.map(({ to, en, ar, icon: Icon, active }) => (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-bold ${active ? "bg-brand-olive/10 text-brand-olive" : "text-brand-text"}`}
                >
                  <Icon className="w-5 h-5 text-brand-amber" /> {isArabic ? ar : en}
                </Link>
              ))}
            </nav>
            <Link
              to="/me"
              className="mt-1 flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-bold text-brand-text"
            >
              <Stamp className="w-5 h-5 text-brand-amber" /> {isArabic ? "جواز سفري" : "My passport"}
            </Link>
            {pendingReviews !== null && (
              <Link
                to="/admin/review"
                className="mt-1 flex min-h-12 items-center gap-3 rounded-2xl px-4 text-base font-bold text-brand-text"
              >
                <ShieldCheck className="w-5 h-5 text-brand-amber" /> {isArabic ? "مراجعة الحكايات" : "Review stories"}
                {pendingReviews > 0 && <span className="rounded-full bg-brand-amber px-2 text-xs text-white">{pendingReviews}</span>}
              </Link>
            )}
            <p className="mt-4 mb-2 px-4 text-xs font-bold text-brand-muted">{isArabic ? "المحافظات" : "Governorates"}</p>
            <div className="grid grid-cols-2 gap-2">
              {governorates.map((item) => (
                <Link
                  key={item.id}
                  to={`/governorates/${item.id}`}
                  className={`flex min-h-12 items-center justify-center rounded-2xl border text-sm font-bold ${
                    governorateId === item.id ? "border-brand-olive bg-brand-olive text-white" : "border-brand-border bg-brand-surface text-brand-olive"
                  }`}
                >
                  {isArabic ? item.arabicName : item.name}
                </Link>
              ))}
            </div>
            {isJerusalem ? (
              <button type="button" onClick={() => { setMenuOpen(false); setStoryOpen(true); }} className={mobileStoryButton}>
                <BookHeart className="w-5 h-5 text-brand-amber-light" />
                {isArabic ? "أنشئ حكايتك" : "Create your story"}
              </button>
            ) : (
              <Link to={storyPath} className={mobileStoryButton}>
                <BookHeart className="w-5 h-5 text-brand-amber-light" />
                {isArabic ? "أنشئ حكايتك" : "Create your story"}
              </Link>
            )}
          </div>
        )}
      </header>
      <main id="main" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1"><Outlet /></main>
      <footer className="mt-8 border-t border-brand-border-light py-8">
        <div className="max-w-7xl mx-auto flex flex-col items-center justify-between gap-4 px-4 text-sm text-brand-muted sm:flex-row sm:px-6 lg:px-8">
          <p>
            © 2026 {isArabic ? "حكاية" : "Hikaya"} · {isArabic ? "المرشد الرقمي للتراث الفلسطيني" : "The digital guide to Palestinian heritage"}
          </p>
          <nav aria-label={isArabic ? "روابط التذييل" : "Footer"} className="flex gap-5 font-bold">
            <Link to="/contribute" className="hover:text-brand-olive">{isArabic ? "شارك حكاية" : "Contribute"}</Link>
            <Link to="/about" className="hover:text-brand-olive">{isArabic ? "عن المنصة" : "About"}</Link>
          </nav>
        </div>
      </footer>
      <MyJerusalemStoryModal open={storyOpen} onClose={() => setStoryOpen(false)} />
      <AccountToasts />
    </div>
  );
};
