import React, { useCallback, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Check,
  Compass,
  Eye,
  EyeOff,
  Filter,
  LocateFixed,
  MapPin,
  Maximize2,
  Minus,
  Navigation2,
  Plus,
  Route as RouteIcon,
} from "lucide-react";
import { ApiLocation } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { locationById } from "../data/heritage";

interface MvpLocationMapProps {
  locations: ApiLocation[];
  selectedId?: string;
  onSelect: (location: ApiLocation) => void;
  visited?: string[];
  routeIds?: string[];
  bounds?: typeof BOUNDS;
  mapLabel?: string;
  jerusalem?: boolean;
  drawRoute?: boolean;
}

const BOUNDS = { minLng: 35.215, maxLng: 35.255, minLat: 31.765, maxLat: 31.798 };
const MAP = { left: 65, top: 55, width: 870, height: 650 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;
const ZOOM_STEP = 0.35;

type MapPoint = { x: number; y: number };
type GestureStart = {
  distance: number;
  zoom: number;
  pan: MapPoint;
  center: MapPoint;
};

const CATEGORY_STYLE: Record<string, { color: string; en: string; ar: string }> = {
  "متحف": { color: "#416759", en: "Museum", ar: "متحف" },
  "تراث ثقافي": { color: "#98723a", en: "Cultural heritage", ar: "تراث ثقافي" },
  "معلم ديني": { color: "#d97706", en: "Sacred site", ar: "معلم ديني" },
  "سوق تراثي": { color: "#98723a", en: "Historic souq", ar: "سوق تراثي" },
  "حارة تاريخية": { color: "#5a5a40", en: "Historic quarter", ar: "حارة تاريخية" },
  "حي مقدسي": { color: "#688158", en: "Jerusalem neighbourhood", ar: "حي مقدسي" },
};

const CATEGORY_ORDER = Object.keys(CATEGORY_STYLE);

function point(lat: number, lng: number, bounds = BOUNDS) {
  return {
    x: MAP.left + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * MAP.width,
    y: MAP.top + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * MAP.height,
  };
}

function styleFor(location: ApiLocation) {
  const primary = CATEGORY_ORDER.find((category) => location.categories.includes(category));
  return CATEGORY_STYLE[primary ?? "حارة تاريخية"];
}

const OLD_CITY = [
  [31.7830, 35.2275], [31.78335, 35.2320], [31.7822, 35.2370],
  [31.7783, 35.2382], [31.7737, 35.2362], [31.7731, 35.2311],
  [31.7742, 35.2273], [31.7790, 35.2264],
] as const;

const GATES = [
  { lat: 31.78165, lng: 35.23085, ar: "باب العامود", en: "Damascus Gate" },
  { lat: 31.78088, lng: 35.23688, ar: "باب الأسباط", en: "Lions’ Gate" },
  { lat: 31.77675, lng: 35.22753, ar: "باب الخليل", en: "Jaffa Gate" },
  { lat: 31.77355, lng: 35.23405, ar: "باب المغاربة", en: "Maghariba Gate" },
];

const LABEL_PLACEMENT: Record<string, string> = {
  "muslim-quarter": "bottom-full mb-1 left-1",
  "christian-quarter": "top-1/2 -translate-y-1/2 right-full mr-1",
  "armenian-quarter": "top-full mt-1 right-1",
  "maghariba-quarter": "top-full mt-1 left-1",
  "bab-al-amud": "bottom-full mb-1 right-0",
  "sheikh-jarrah": "bottom-full mb-1 left-1/2 -translate-x-1/2",
  "silwan": "top-full mt-1 left-1/2 -translate-x-1/2",
  "at-tur": "bottom-full mb-1 left-1/2 -translate-x-1/2",
};

const COMPACT_NAMES: Record<string, { ar: string; en: string }> = {
  "muslim-quarter": { ar: "حارة المسلمين", en: "Muslim Quarter" },
  "christian-quarter": { ar: "حارة النصارى", en: "Christian Quarter" },
  "armenian-quarter": { ar: "حارة الأرمن", en: "Armenian Quarter" },
  "maghariba-quarter": { ar: "حارة المغاربة", en: "Maghariba Quarter" },
  "bab-al-amud": { ar: "باب العامود", en: "Bab al-Amud" },
  "sheikh-jarrah": { ar: "الشيخ جراح", en: "Sheikh Jarrah" },
  "silwan": { ar: "سلوان", en: "Silwan" },
  "at-tur": { ar: "الطور", en: "At-Tur" },
};

export const MvpLocationMap: React.FC<MvpLocationMapProps> = ({
  locations,
  selectedId,
  onSelect,
  visited = [],
  routeIds = [],
  bounds = BOUNDS, mapLabel, jerusalem = true, drawRoute = true,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const project = useCallback((lat: number,lng: number) => point(lat,lng,bounds),[bounds]);
  const [active, setActive] = useState<string[]>([]);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [pan, setPan] = useState<MapPoint>({ x: 0, y: 0 });
  const [showAllLabels, setShowAllLabels] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const pointersRef = useRef(new Map<number, MapPoint>());
  const dragStartRef = useRef<{ pointer: MapPoint; pan: MapPoint } | null>(null);
  const gestureStartRef = useRef<GestureStart | null>(null);

  const available = useMemo(() => {
    const present = new Set<string>();
    locations.forEach((location) => location.categories.forEach((category) => present.add(category)));
    return CATEGORY_ORDER.filter((category) => present.has(category));
  }, [locations]);

  const plottable = locations.filter((location) => location.latitude != null && location.longitude != null);
  const shown = active.length
    ? plottable.filter((location) => location.categories.some((category) => active.includes(category)))
    : plottable;
  const routePoints = routeIds.map((id) => locations.find((location) => location.id === id)).filter((item): item is ApiLocation => Boolean(item?.latitude != null && item?.longitude != null)).map((item) => project(item.latitude!, item.longitude!));
  const wallPoints = OLD_CITY.map(([lat, lng]) => { const p = project(lat, lng); return `${p.x},${p.y}`; }).join(" ");

  const clampPan = useCallback((candidate: MapPoint, nextZoom: number): MapPoint => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || nextZoom <= MIN_ZOOM) return { x: 0, y: 0 };
    return {
      x: Math.min(0, Math.max(rect.width - rect.width * nextZoom, candidate.x)),
      y: Math.min(0, Math.max(rect.height - rect.height * nextZoom, candidate.y)),
    };
  }, []);

  const commitView = useCallback((nextZoom: number, candidatePan: MapPoint) => {
    const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const boundedPan = clampPan(candidatePan, boundedZoom);
    zoomRef.current = boundedZoom;
    panRef.current = boundedPan;
    setZoom(boundedZoom);
    setPan(boundedPan);
  }, [clampPan]);

  const zoomAt = useCallback((nextZoom: number, anchor: MapPoint) => {
    const currentZoom = zoomRef.current;
    const ratio = nextZoom / currentZoom;
    commitView(nextZoom, {
      x: anchor.x - (anchor.x - panRef.current.x) * ratio,
      y: anchor.y - (anchor.y - panRef.current.y) * ratio,
    });
  }, [commitView]);

  const zoomBy = useCallback((amount: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(zoomRef.current + amount, { x: rect.width / 2, y: rect.height / 2 });
  }, [zoomAt]);

  const resetView = useCallback(() => commitView(MIN_ZOOM, { x: 0, y: 0 }), [commitView]);

  const focusSelected = useCallback(() => {
    const selected = locations.find((location) => location.id === selectedId);
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!selected || selected.latitude == null || selected.longitude == null || !rect) return;
    const selectedPoint = project(selected.latitude, selected.longitude);
    const nextZoom = 2.25;
    commitView(nextZoom, {
      x: rect.width / 2 - (selectedPoint.x / 1000) * rect.width * nextZoom,
      y: rect.height / 2 - (selectedPoint.y / 760) * rect.height * nextZoom,
    });
  }, [commitView, locations, selectedId]);

  const fitRoute = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect || routePoints.length === 0) return;
    if (routePoints.length === 1) {
      const only = routePoints[0];
      const nextZoom = 2.25;
      commitView(nextZoom, {
        x: rect.width / 2 - (only.x / 1000) * rect.width * nextZoom,
        y: rect.height / 2 - (only.y / 760) * rect.height * nextZoom,
      });
      return;
    }

    const xs = routePoints.map((item) => item.x / 1000);
    const ys = routePoints.map((item) => item.y / 760);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(.12, maxX - minX);
    const spanY = Math.max(.12, maxY - minY);
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(.72 / spanX, .72 / spanY)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    commitView(nextZoom, {
      x: rect.width / 2 - centerX * rect.width * nextZoom,
      y: rect.height / 2 - centerY * rect.height * nextZoom,
    });
  }, [commitView, routePoints]);

  const pointerPosition = (clientX: number, clientY: number): MapPoint => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-map-control], [data-map-marker]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 1) {
      dragStartRef.current = {
        pointer: { x: event.clientX, y: event.clientY },
        pan: { ...panRef.current },
      };
    } else if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      const center = pointerPosition((first.x + second.x) / 2, (first.y + second.y) / 2);
      gestureStartRef.current = {
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        zoom: zoomRef.current,
        pan: { ...panRef.current },
        center,
      };
      dragStartRef.current = null;
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 2 && gestureStartRef.current) {
      const [first, second] = [...pointersRef.current.values()];
      const currentDistance = Math.hypot(second.x - first.x, second.y - first.y);
      const currentCenter = pointerPosition((first.x + second.x) / 2, (first.y + second.y) / 2);
      const start = gestureStartRef.current;
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * (currentDistance / Math.max(1, start.distance))));
      const ratio = nextZoom / start.zoom;
      commitView(nextZoom, {
        x: currentCenter.x - (start.center.x - start.pan.x) * ratio,
        y: currentCenter.y - (start.center.y - start.pan.y) * ratio,
      });
      return;
    }

    if (pointersRef.current.size === 1 && dragStartRef.current && zoomRef.current > MIN_ZOOM) {
      commitView(zoomRef.current, {
        x: dragStartRef.current.pan.x + event.clientX - dragStartRef.current.pointer.x,
        y: dragStartRef.current.pan.y + event.clientY - dragStartRef.current.pointer.y,
      });
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    gestureStartRef.current = null;
    const remaining = [...pointersRef.current.values()][0];
    dragStartRef.current = remaining
      ? { pointer: remaining, pan: { ...panRef.current } }
      : null;
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const anchor = pointerPosition(event.clientX, event.clientY);
    zoomAt(zoomRef.current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), anchor);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-map-control], [data-map-marker]")) return;
    zoomAt(zoomRef.current + .65, pointerPosition(event.clientX, event.clientY));
  };

  const zoomPercent = Math.round(zoom * 100);
  const showDetailedMapLabels = zoom >= 1.4 || routePoints.length < 2;

  const toggle = (category: string) => setActive((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-brand-muted inline-flex items-center gap-1.5"><Filter className="w-3 h-3" />{isArabic ? "تصفية" : "Filter"}</span>
        {available.map((category) => {
          const style = CATEGORY_STYLE[category];
          const on = active.includes(category);
          return <button key={category} type="button" onClick={() => toggle(category)} aria-pressed={on} className={`text-[10px] px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition-colors ${on ? "bg-brand-olive text-white border-brand-olive" : "bg-white text-brand-muted border-brand-border hover:border-brand-amber"}`}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: style.color }} />{isArabic ? style.ar : style.en}</button>;
        })}
        {active.length > 0 && <button type="button" onClick={() => setActive([])} className="text-[10px] text-brand-muted hover:text-brand-olive underline underline-offset-2">{isArabic ? "إلغاء التصفية" : "Clear"}</button>}
      </div>

      <div
        ref={viewportRef}
        className={`relative w-full h-[500px] sm:h-[610px] rounded-3xl border border-brand-border overflow-hidden shadow-xl bg-[#eae3d3] select-none ${zoom > MIN_ZOOM ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="absolute inset-0 will-change-transform"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 760" preserveAspectRatio="none" role="img" aria-label={mapLabel ?? (isArabic ? "خريطة توضيحية للقدس" : "Illustrated Jerusalem map")}>
          <defs>
            <linearGradient id="mapPaper" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f8f4e9" /><stop offset="1" stopColor="#e4dcc8" /></linearGradient>
            <pattern id="mapGrain" width="34" height="34" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#8d856f" opacity=".14" /></pattern>
            <filter id="wallShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#5a503b" floodOpacity=".18" /></filter>
          </defs>
          <rect width="1000" height="760" fill="url(#mapPaper)" />
          <rect width="1000" height="760" fill="url(#mapGrain)" />

          {jerusalem && <>
          {/* Terrain contours: a quiet geographic backdrop rather than an empty grid. */}
          <g fill="none" stroke="#8f8a73" strokeWidth="1.2" opacity=".2">
            <path d="M20 105 C180 35 300 150 455 95 S760 55 980 115" />
            <path d="M5 160 C180 90 330 190 480 145 S780 105 995 170" />
            <path d="M-20 650 C180 590 280 690 445 635 S750 570 1020 625" />
            <path d="M-10 705 C200 650 330 735 500 690 S790 635 1010 700" />
            <path d="M780 35 C690 180 790 260 740 390 S720 590 810 740" />
            <path d="M850 20 C760 180 850 275 810 420 S805 600 900 745" />
          </g>

          {/* Main approaches and the Kidron Valley. */}
          <g fill="none" strokeLinecap="round">
            <path d="M340 45 C360 145 390 225 420 315" stroke="#c4b89e" strokeWidth="9" opacity=".58" />
            <path d="M420 315 C350 410 340 565 410 735" stroke="#c4b89e" strokeWidth="7" opacity=".48" />
            <path d="M420 315 C600 275 720 280 875 225" stroke="#c4b89e" strokeWidth="7" opacity=".48" />
            <path d="M630 215 C610 340 655 520 610 725" stroke="#9bb1a0" strokeWidth="18" opacity=".2" />
            <path d="M630 215 C610 340 655 520 610 725" stroke="#6d8876" strokeWidth="2" strokeDasharray="7 8" opacity=".55" />
          </g>

          {/* Old City walls and subtle quarter areas. */}
          <polygon points={wallPoints} fill="#f4ecd8" stroke="#6d654d" strokeWidth="7" strokeLinejoin="round" filter="url(#wallShadow)" />
          <path d="M300 343 L432 326 L424 420 L300 430 Z" fill="#b87a5b" opacity=".12" />
          <path d="M432 326 L555 350 L550 445 L424 420 Z" fill="#d09b51" opacity=".13" />
          <path d="M300 430 L424 420 L415 520 L310 510 Z" fill="#668067" opacity=".13" />
          <path d="M424 420 L550 445 L530 520 L415 520 Z" fill="#8b6b52" opacity=".12" />
          <g stroke="#8f8368" strokeWidth="2" opacity=".45"><path d="M300 430 L550 445" /><path d="M424 330 L415 520" /></g>

          {GATES.map((gate) => {
            const p = project(gate.lat, gate.lng);
            const labelDirection = gate.en === "Lions’ Gate" ? 1 : -1;
            return <g key={gate.en}>
              <circle cx={p.x} cy={p.y} r={4.5 / zoom} fill="#d97706" stroke="#fffaf0" strokeWidth={2 / zoom} opacity={showDetailedMapLabels ? .9 : .38} />
              {showDetailedMapLabels && (
                <text
                  x={p.x + labelDirection * (9 / zoom)}
                  y={p.y - (8 / zoom)}
                  textAnchor={labelDirection > 0 ? "start" : "end"}
                  fontSize={9.5 / zoom}
                  fontWeight="700"
                  fill="#655d48"
                  opacity=".78"
                >
                  {isArabic ? gate.ar : gate.en}
                </text>
              )}
            </g>;
          })}

          <g fontSize={12 / zoom} fontWeight="700" fill="#6d654d" opacity=".7">
            {showDetailedMapLabels && <text x="420" y="392" textAnchor="middle">{isArabic ? "البلدة القديمة" : "OLD CITY"}</text>}
            <text x="355" y="120" textAnchor="middle">{isArabic ? "الشيخ جراح" : "SHEIKH JARRAH"}</text>
            <text x="820" y="205" textAnchor="middle">{isArabic ? "الطور وجبل الزيتون" : "AT-TUR · MOUNT OF OLIVES"}</text>
            <text x="500" y="665" textAnchor="middle">{isArabic ? "سلوان" : "SILWAN"}</text>
            <text x="670" y="520" textAnchor="middle" transform="rotate(83 670 520)" fontSize={9.5 / zoom}>{isArabic ? "وادي قدرون" : "KIDRON VALLEY"}</text>
          </g>

          </>}

          {drawRoute && routePoints.length > 1 && <polyline points={routePoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#fffaf0" strokeWidth="7" opacity=".82" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          {drawRoute && routePoints.length > 1 && <polyline points={routePoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#d97706" strokeWidth="3" strokeDasharray={`${7 / zoom} ${7 / zoom}`} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}

          <g transform="translate(895 90)" fill="#5a5a40"><path d="M0 30 L12 0 L24 30 L12 24 Z" fill="#d97706" /><text x="12" y="48" textAnchor="middle" fontSize={14 / zoom} fontWeight="800">{isArabic ? "ش" : "N"}</text></g>
          {jerusalem && <g transform="translate(65 710)" stroke="#5a5a40" strokeWidth="4"><path d="M0 0 H80" /><path d="M0 -5 V5 M80 -5 V5" /><text x="40" y="20" textAnchor="middle" stroke="none" fill="#5a5a40" fontSize={12 / zoom}>{isArabic ? "≈ ١ كم" : "≈ 1 km"}</text></g>}
        </svg>

        {shown.map((location, index) => {
          const p = project(location.latitude!, location.longitude!);
          const x = (p.x / 1000) * 100;
          const y = (p.y / 760) * 100;
          const isSelected = location.id === selectedId;
          const style = styleFor(location);
          const seen = visited.includes(location.id);
          const profile = locationById(location.id);
          const label = isArabic ? (profile?.arabicName ?? location.arabicName ?? location.name) : location.name;
          const compactName = COMPACT_NAMES[location.id];
          const useCompactName = zoom < 1.4 && Boolean(compactName);
          const displayLabel = useCompactName
            ? (isArabic ? compactName.ar : compactName.en)
            : label;
          const labelFontSize = zoom < 1.4 ? 8.5 : zoom < 2.25 ? 9.25 : 10;
          const labelPaddingX = zoom < 1.4 ? 6 : zoom < 2.25 ? 7.5 : 9;
          const labelPaddingY = zoom < 1.4 ? 2.5 : 3;
          const routeIndex = routeIds.indexOf(location.id);
          const onRoute = routeIndex >= 0;
          const labelVisible = isSelected || showAllLabels;
          return <button data-map-marker key={location.id} type="button" onClick={() => onSelect(location)} aria-pressed={isSelected} aria-label={isArabic ? `اختر ${label}` : `Select ${label}`} className={`absolute group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber rounded-full transition-opacity ${isSelected ? "z-30" : "z-20 hover:z-30"}`} style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) scale(${1 / zoom})`, opacity: reduced ? 1 : Math.min(1, .72 + index * .04) }}>
            <span
              className={`absolute whitespace-nowrap rounded-full font-bold border shadow-sm transition-[opacity,background-color,color,border-color] duration-200 ${LABEL_PLACEMENT[location.id] ?? "bottom-full mb-1 left-1/2 -translate-x-1/2"} ${isSelected ? "bg-brand-olive text-white border-brand-olive opacity-100" : `bg-[#fffaf0]/92 text-brand-text border-white/85 ${labelVisible ? "opacity-95" : "pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}`}
              style={{
                fontSize: `${labelFontSize}px`,
                lineHeight: 1.15,
                paddingInline: `${labelPaddingX}px`,
                paddingBlock: `${labelPaddingY}px`,
              }}
            >
              {displayLabel}
            </span>
            <span className="relative flex items-center justify-center">
              {isSelected && !reduced && <motion.span className="absolute w-10 h-10 rounded-full bg-brand-amber/25" animate={{ scale: [1, 1.7], opacity: [.7, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />}
              <span
                className={`w-9 h-9 rounded-full border-[3px] border-[#fffaf0] shadow-lg flex items-center justify-center ${isSelected ? "ring-4 ring-brand-amber/20" : ""}`}
                style={{ backgroundColor: onRoute ? "#d97706" : style.color }}
              >
                {onRoute
                  ? <span className="text-xs font-black text-white" aria-hidden="true">{routeIndex + 1}</span>
                  : <MapPin className="w-5 h-5 text-white" />}
              </span>
              {seen && !onRoute && <Check className="absolute -end-2 -top-1 w-4 h-4 p-0.5 text-white bg-brand-olive rounded-full" />}
            </span>
          </button>;
        })}
        </div>

        <div className="absolute top-5 start-5 z-30 max-w-[calc(100%-6.5rem)] rounded-2xl bg-[#fffaf0]/92 backdrop-blur px-4 py-3 border border-white/70 shadow-sm pointer-events-none">
          <p className="text-[10px] uppercase tracking-widest text-brand-muted inline-flex items-center gap-1.5"><Compass className="w-3 h-3 text-brand-amber" />{mapLabel ?? (isArabic ? "القدس وضواحي البلدة القديمة" : "Jerusalem & Old City approaches")}</p>
          <p className="font-serif font-black text-lg text-brand-olive">{isArabic ? `${shown.length} أماكن موثقة` : `${shown.length} documented places`}</p>
        </div>

        <div data-map-control className="absolute top-5 end-5 z-40 flex flex-col items-center gap-2">
          <div className="overflow-hidden rounded-2xl border border-white/80 bg-[#fffaf0]/95 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              className="grid h-10 w-11 place-items-center text-brand-olive transition hover:bg-brand-amber/10 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={isArabic ? "تكبير الخريطة" : "Zoom in"}
              title={isArabic ? "تكبير" : "Zoom in"}
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="block border-y border-brand-border-light py-1 text-center font-mono text-[9px] text-brand-muted" aria-live="polite">{zoomPercent}%</span>
            <button
              type="button"
              onClick={() => zoomBy(-ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              className="grid h-10 w-11 place-items-center text-brand-olive transition hover:bg-brand-amber/10 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={isArabic ? "تصغير الخريطة" : "Zoom out"}
              title={isArabic ? "تصغير" : "Zoom out"}
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={resetView}
            className="grid h-10 w-11 place-items-center rounded-xl border border-white/80 bg-[#fffaf0]/95 text-brand-olive shadow-md backdrop-blur transition hover:bg-brand-amber hover:text-white"
            aria-label={isArabic ? "عرض الخريطة كاملة" : "Show the full map"}
            title={isArabic ? "عرض الخريطة كاملة" : "Fit all"}
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {routePoints.length > 0 && (
            <button
              type="button"
              onClick={fitRoute}
              className="grid h-10 w-11 place-items-center rounded-xl border border-white/80 bg-brand-amber text-white shadow-md transition hover:bg-[#b45f05]"
              aria-label={jerusalem ? (isArabic ? "ملاءمة المسار داخل الخريطة" : "Fit route in the map") : (isArabic ? "إظهار أماكن الحكاية في الخريطة" : "Fit story chapters in the map")}
              title={jerusalem ? (isArabic ? "ركّز على المسار" : "Fit route") : (isArabic ? "أماكن الحكاية" : "Fit chapters")}
            >
              <RouteIcon className="h-4 w-4" />
            </button>
          )}

          {selectedId && locations.some((item) => item.id === selectedId && item.latitude != null && item.longitude != null) && (
            <button
              type="button"
              onClick={focusSelected}
              className="grid h-10 w-11 place-items-center rounded-xl border border-white/80 bg-[#fffaf0]/95 text-brand-olive shadow-md backdrop-blur transition hover:bg-brand-olive hover:text-white"
              aria-label={isArabic ? "ركّز على المكان المحدد" : "Focus the selected place"}
              title={isArabic ? "ركّز على المكان" : "Focus selected"}
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAllLabels((current) => !current)}
            aria-pressed={showAllLabels}
            className={`grid h-10 w-11 place-items-center rounded-xl border shadow-md backdrop-blur transition ${showAllLabels ? "border-brand-olive bg-brand-olive text-white" : "border-white/80 bg-[#fffaf0]/95 text-brand-olive hover:bg-brand-olive/10"}`}
            aria-label={isArabic ? (showAllLabels ? "إخفاء أسماء الأماكن" : "إظهار أسماء الأماكن") : (showAllLabels ? "Hide place names" : "Show place names")}
            title={isArabic ? (showAllLabels ? "إخفاء أسماء الأماكن" : "إظهار أسماء الأماكن") : (showAllLabels ? "Hide place names" : "Show place names")}
          >
            {showAllLabels ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {shown.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-brand-muted font-serif italic px-8 text-center z-20">{isArabic ? "لا توجد أماكن تطابق خيارات التصفية." : "No sites match the selected filters."}</p>}

        <div className="absolute bottom-4 end-5 z-30 rounded-xl bg-[#fffaf0]/90 backdrop-blur px-3 py-2 border border-white/70 text-[10px] text-brand-muted inline-flex items-center gap-1.5 pointer-events-none"><Navigation2 className="w-3 h-3 text-brand-amber" />{isArabic ? "اسحب للتحريك · قرّب بإصبعين · اضغط العلامة" : "Drag to pan · pinch to zoom · select a marker"}</div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {available.map((category) => <span key={category} className="text-[10px] text-brand-muted inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_STYLE[category].color }} />{isArabic ? CATEGORY_STYLE[category].ar : CATEGORY_STYLE[category].en}</span>)}
        {drawRoute && routeIds.length > 1 && <span className="text-[10px] text-brand-amber inline-flex items-center gap-1"><span className="w-5 border-t-2 border-dashed border-brand-amber" />{isArabic ? "المسار المقترح" : "Suggested route"}</span>}
      </div>
      <p className="text-[10px] text-brand-muted">{!jerusalem ? (isArabic ? "خريطة نقاط مرجعية دون اتصال؛ لا تعرض حدوداً أو طرقاً أو مداخل مؤكدة. الأماكن التي لم تُوثّق إحداثياتها متاحة في القائمة." : "Offline reference-point map; no boundaries, roads or verified entrances are implied. Places awaiting coordinate verification remain available in the list.") : isArabic ? "خريطة توضيحية تعمل دون اتصال. اتبع زر الاتجاهات لكل محطة للحصول على مسار مشي حي، وتحقق محلياً من الوصول وساعات الفتح والظروف الراهنة." : "Offline illustrated map. Use each stop’s directions button for live walking navigation, and verify current access, opening hours and local conditions."}</p>
    </div>
  );
};
