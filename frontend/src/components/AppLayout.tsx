import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BookHeart, Heart, Home, Info, Languages, MapPin, PenLine, Route, Waypoints } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { MyJerusalemStoryModal } from "./MyJerusalemStoryModal";
import { governorates, nationalRecord } from "../data/heritage";
import { OPEN_JERUSALEM_STORY_EVENT } from "../services/progress";
import { AccountChip, AccountToasts } from "./AccountWidgets";

const NAV_ITEMS = [
  { to: "/", en: "Home", ar: "الرئيسية", icon: Home, end: true },
  { to: "/create-story", en: "My Palestine story", ar: "حكايتي في فلسطين", icon: Route, end: false },
  { to: "/palestine-map", en: "Map", ar: "الخريطة", icon: MapPin, end: false },
  { to: "/constellation", en: "Connections", ar: "الروابط", icon: Waypoints, end: false },
  { to: "/contribute", en: "Contribute", ar: "شارك حكاية", icon: PenLine, end: false },
  { to: "/about", en: "About", ar: "عن المنصة", icon: Info, end: false },
];

export const AppLayout: React.FC = () => {
  const { language, setLanguage, isArabic } = useInterfaceLanguage();
  const [storyOpen, setStoryOpen] = useState(false);
  const {pathname}=useLocation();
  const isJerusalem = ['/jerusalem','/map','/plan-tour','/constellation'].includes(pathname) || pathname.startsWith('/governorates/jerusalem') || (pathname.startsWith('/locations/') && !nationalRecord(pathname.split('/')[2]));
  const items = isJerusalem ? NAV_ITEMS.map((item) => item.to === '/create-story' ? {...item,to:'/plan-tour',en:'Plan tour',ar:'صمّم جولتك'} : item.to === '/palestine-map' ? {...item,to:'/map'} : item.to === '/' ? {...item,to:'/governorates/jerusalem'} : item) : NAV_ITEMS.map((item)=>item.to === "/constellation" ? {...item,to:"/palestine-connections"} : item);

  useEffect(() => {
    const openStory = () => setStoryOpen(true);
    window.addEventListener(OPEN_JERUSALEM_STORY_EVENT, openStory);
    return () => window.removeEventListener(OPEN_JERUSALEM_STORY_EVENT, openStory);
  }, []);

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-col" dir={isArabic ? "rtl" : "ltr"}>
      <div className="h-2 w-full bg-gradient-to-r from-brand-olive via-brand-amber to-brand-olive" />
      <header className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-5 pb-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <Link to="/" className="group flex max-w-[480px] items-center gap-3 sm:gap-4" aria-label="Hikaya | حكاية">
            <picture className="shrink-0 mix-blend-multiply">
              <source media="(max-width: 520px)" srcSet="/logo-icon.png" />
              <img src="/logo-horizontal.png" alt="Hikaya | حكاية" className="h-[52px] w-auto max-w-[150px] object-contain sm:h-[78px] sm:max-w-[185px]" />
            </picture>
            <span className="hidden sm:block h-9 w-px shrink-0 bg-brand-border-light" aria-hidden="true" />
            <p className="hidden sm:block max-w-[16rem] text-xs leading-relaxed text-brand-muted">{isJerusalem ? (isArabic?"المرشد السياحي الرقمي الذكي للقدس":"The intelligent digital guide to Jerusalem") : (isArabic ? "المرشد الرقمي للتراث الفلسطيني" : "The digital guide to Palestinian heritage")}</p>
          </Link>
          <div className="flex flex-wrap items-center gap-2 self-start">
            {isJerusalem ? <button type="button" onClick={()=>setStoryOpen(true)} className="bg-brand-olive text-brand-bg text-[10px] font-bold px-3 py-2 rounded-full inline-flex items-center gap-1.5"><BookHeart className="w-3.5 h-3.5 text-brand-amber"/>{isArabic?"إنشاء حكايتي في القدس":"Generate My Jerusalem Story"}</button> : <Link to="/create-story" className="bg-brand-olive text-brand-bg text-[10px] font-bold px-3 py-2 rounded-full inline-flex items-center gap-1.5">
              <BookHeart className="w-3.5 h-3.5 text-brand-amber" /> {isArabic ? "إنشاء حكايتي في فلسطين" : "Create My Story in Palestine"}
            </Link>}
            <button type="button" onClick={() => setLanguage(language === "ar" ? "en" : "ar")} aria-label={isArabic ? "التبديل إلى الإنجليزية" : "Switch to Arabic"} className="bg-white border border-brand-border text-brand-olive text-[10px] font-bold px-3 py-2 rounded-full inline-flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5" /> {language === "ar" ? "EN" : "العربية"}
            </button>
            <AccountChip />
          </div>
        </div>
        {/* One scrollable row on phones instead of two wrapped rows. */}
        <nav className="flex flex-nowrap sm:flex-wrap items-center gap-1 mt-3 sm:mt-5 border-b border-brand-border-light overflow-x-auto [scrollbar-width:none]">
          {items.map(({ to, en, ar, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `shrink-0 whitespace-nowrap pb-3 pt-1 text-[11px] font-serif font-bold border-b-2 px-3 transition-colors flex items-center gap-1.5 ${isActive ? "border-brand-olive text-brand-olive" : "border-transparent text-brand-muted hover:text-brand-olive"}`}>
              <Icon className="w-3.5 h-3.5" /> {isArabic ? ar : en}
            </NavLink>
          ))}
        </nav>
        <nav aria-label={isArabic?'المحافظات':'Governorates'} className="flex flex-wrap gap-3 pt-3 text-xs text-brand-muted">
          {isJerusalem && <Link to="/" className="text-brand-olive font-bold">{isArabic?'فلسطين':'Palestine'}</Link>}
          {governorates.map((item)=><NavLink key={item.id} to={`/governorates/${item.id}`} className={({isActive})=>isActive?'text-brand-olive font-bold':'hover:text-brand-amber'}>{isArabic?item.arabicName:item.name}</NavLink>)}
        </nav>
      </header>
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1"><Outlet /></main>
      <footer className="mt-8 py-8 text-center text-[10px] text-brand-muted font-mono tracking-widest space-y-1 border-t border-brand-border-light">
        <p>© 2026 Hikaya · حكاية</p>
        <div className="flex justify-center items-center gap-1.5 text-brand-amber"><Heart className="w-3 h-3 fill-current" /> {isArabic ? "Hikaya" : "Hikaya"}</div>
      </footer>
      <MyJerusalemStoryModal open={storyOpen} onClose={() => setStoryOpen(false)} />
      <AccountToasts />
    </div>
  );
};
