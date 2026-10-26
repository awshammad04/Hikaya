import React from "react";
import { Link } from "react-router-dom";
import { governorates } from "../data/heritage";
import { useInterfaceLanguage } from "../context/LanguageContext";

/*
 * Physical geography only - the Mediterranean coast, the Jordan River and the
 * Dead Sea - so maps have orientation without implying any boundary lines.
 * Points are approximate [lat, lng] pairs, good for an overview scale.
 */
const COAST: [number, number][] = [
  [32.3, 34.86], [32.15, 34.79], [32.05, 34.75], [31.92, 34.7], [31.8, 34.63],
  [31.67, 34.55], [31.57, 34.49], [31.52, 34.43], [31.46, 34.36], [31.4, 34.3],
  [31.32, 34.22], [31.25, 34.05], [31.12, 33.85],
];
const SEA: [number, number][] = [...COAST, [31.12, 33.4], [32.3, 33.4]];
const DEAD_SEA: [number, number][] = [
  [31.77, 35.56], [31.74, 35.47], [31.68, 35.44], [31.5, 35.39], [31.35, 35.38],
  [31.2, 35.4], [31.12, 35.43], [31.2, 35.5], [31.3, 35.55], [31.48, 35.58], [31.65, 35.59],
];
const JORDAN: [number, number][] = [
  [31.77, 35.56], [31.84, 35.545], [31.9, 35.555], [31.97, 35.54], [32.05, 35.535],
  [32.12, 35.55], [32.2, 35.56], [32.3, 35.57],
];

/*
 * The central highlands from Nablus to Hebron, the ridge the hill towns sit
 * on. Drawn as soft relief, never as a crisp line, so it cannot read as one.
 */
const RIDGE: [number, number][] = [
  [32.3, 35.28], [32.22, 35.26], [32.08, 35.24], [31.95, 35.21], [31.85, 35.2],
  [31.75, 35.2], [31.65, 35.17], [31.53, 35.1], [31.42, 35.03], [31.33, 34.98],
];

const shifted = (points: [number, number][], dLat: number, dLng: number) =>
  points.map(([lat, lng]): [number, number] => [lat + dLat, lng + dLng]);

/** The outline pulled toward its centre, for water-lining inside the lake. */
const shrunk = (points: [number, number][], factor: number) => {
  const lat = points.reduce((sum, [a]) => sum + a, 0) / points.length;
  const lng = points.reduce((sum, [, b]) => sum + b, 0) / points.length;
  return points.map(([a, b]): [number, number] => [lat + (a - lat) * factor, lng + (b - lng) * factor]);
};

export type Projector = (lat: number, lng: number) => { x: number; y: number };

const path = (points: [number, number][], project: Projector, close = false) =>
  points
    .map(([lat, lng], index) => {
      const p = project(lat, lng);
      return `${index ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(" ") + (close ? " Z" : "");

interface GeographyLayerProps {
  project: Projector;
  /** Font size for feature names, in SVG units; omit to hide names. */
  labelSize?: number;
  tone?: "paper" | "dark";
}

/**
 * Sea, river, Dead Sea and the highlands drawn into an existing SVG, with
 * the water-lining and relief of a printed map.
 */
export const GeographyLayer: React.FC<GeographyLayerProps> = ({ project, labelSize, tone = "paper" }) => {
  const { isArabic } = useInterfaceLanguage();
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const seaClip = `sea-${uid}`;
  const softRelief = `relief-${uid}`;
  const water = tone === "paper" ? "#b9cdd0" : "rgba(255,255,255,0.14)";
  const shore = tone === "paper" ? "#7f9da3" : "rgba(255,255,255,0.35)";
  const ink = tone === "paper" ? "#5d7a80" : "rgba(255,255,255,0.6)";
  const relief = tone === "paper" ? "#a08c64" : "#ffffff";
  const hills = tone === "paper" ? "#8f7f5c" : "rgba(255,255,255,0.3)";
  const sea = project(32.08, 34.45);
  const dead = project(31.45, 35.49);
  const river = project(32.0, 35.6);
  // Widths in map units for a span of longitude, so every projection agrees.
  const span = (degrees: number) => Math.abs(project(31.8, 35.2 + degrees).x - project(31.8, 35.2).x);
  const hill = span(0.028);
  return (
    <g aria-hidden="true">
      <defs>
        <clipPath id={seaClip}>
          <path d={path(SEA, project, true)} />
        </clipPath>
        <filter id={softRelief} x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation={span(0.05)} />
        </filter>
      </defs>
      <path
        d={path(RIDGE, project)}
        fill="none"
        stroke={relief}
        strokeWidth={span(0.16)}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${softRelief})`}
        opacity={tone === "paper" ? 0.22 : 0.08}
      />
      {/* Hill marks on the eastern slopes, clear of the towns on the ridge. */}
      <g fill="none" stroke={hills} strokeWidth={1} strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity={0.6}>
        {RIDGE.slice(1, -1).map(([lat, lng], index) => {
          const p = project(lat - 0.02, lng + (index % 2 ? 0.11 : 0.16));
          return <path key={index} d={`M${p.x - hill} ${p.y} Q${p.x} ${p.y - hill * 1.3} ${p.x + hill} ${p.y}`} />;
        })}
      </g>
      <path d={path(SEA, project, true)} fill={water} opacity={0.75} />
      <g clipPath={`url(#${seaClip})`} fill="none" stroke={shore} strokeWidth={1} vectorEffect="non-scaling-stroke">
        {[0.03, 0.065, 0.105].map((step, index) => (
          <path key={step} d={path(shifted(COAST, step * 0.4, -step), project)} opacity={0.55 - index * 0.17} />
        ))}
      </g>
      <path d={path(COAST, project)} fill="none" stroke={shore} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <path d={path(DEAD_SEA, project, true)} fill={water} stroke={shore} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <g fill="none" stroke={shore} strokeWidth={0.8} vectorEffect="non-scaling-stroke">
        <path d={path(shrunk(DEAD_SEA, 0.78), project, true)} opacity={0.45} />
        <path d={path(shrunk(DEAD_SEA, 0.56), project, true)} opacity={0.25} />
      </g>
      <path d={path(JORDAN, project)} fill="none" stroke={shore} strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {labelSize && (
        <g fill={ink} fontSize={labelSize} fontWeight={700} opacity={0.9}>
          <text x={sea.x} y={sea.y} textAnchor="middle">{isArabic ? "البحر المتوسط" : "Mediterranean Sea"}</text>
          <text x={dead.x} y={dead.y} textAnchor="middle" fontSize={labelSize * 0.85}>{isArabic ? "البحر الميت" : "Dead Sea"}</text>
          <text x={river.x} y={river.y} textAnchor="middle" fontSize={labelSize * 0.85} transform={`rotate(-80 ${river.x} ${river.y})`}>{isArabic ? "نهر الأردن" : "Jordan River"}</text>
        </g>
      )}
    </g>
  );
};

/** Frame shared by the overview maps: the coast to the Jordan valley. */
export const OVERVIEW_BOUNDS = { minLat: 31.2, maxLat: 32.2, minLng: 34.2, maxLng: 35.7 };

const MINI = { width: 255, height: 200 };
const miniProject: Projector = (lat, lng) => ({
  x: ((lng - OVERVIEW_BOUNDS.minLng) / (OVERVIEW_BOUNDS.maxLng - OVERVIEW_BOUNDS.minLng)) * MINI.width,
  y: ((OVERVIEW_BOUNDS.maxLat - lat) / (OVERVIEW_BOUNDS.maxLat - OVERVIEW_BOUNDS.minLat)) * MINI.height,
});

interface MiniMapProps {
  /** Governorate to emphasise; the others show as quiet dots. */
  highlight?: string;
  /** Turn each governorate into a link with its name. */
  interactive?: boolean;
  /** Crop to a wide strip centred on the highlighted governorate. */
  focus?: boolean;
  className?: string;
}

/** A small orientation map of the four governorates in the archive. */
export const PalestineMiniMap: React.FC<MiniMapProps> = ({ highlight, interactive = false, focus = false, className = "" }) => {
  const { isArabic } = useInterfaceLanguage();
  const centre = highlight ? governorates.find((item) => item.id === highlight)?.mapCenter : undefined;
  const c = centre ? miniProject(centre.latitude, centre.longitude) : null;
  const viewBox = focus && c ? `${c.x - 110} ${c.y - 30} 220 60` : `0 0 ${MINI.width} ${MINI.height}`;
  return (
    <svg viewBox={viewBox} preserveAspectRatio={focus ? "xMidYMid slice" : undefined} className={className} role="img" aria-label={isArabic ? "خريطة المحافظات في الأرشيف" : "Governorates in the archive"}>
      <GeographyLayer project={miniProject} labelSize={interactive ? 8 : undefined} tone="dark" />
      {governorates.map((item) => {
        const p = miniProject(item.mapCenter.latitude, item.mapCenter.longitude);
        const on = highlight ? item.id === highlight : interactive;
        // A cropped strip can cut a neighbour's dot in half at its edge, which
        // reads as a glitch; keep only the neighbours safely inside the crop.
        if (focus && c && !on && (Math.abs(p.x - c.x) > 60 || Math.abs(p.y - c.y) > 22)) return null;
        const name = isArabic ? item.arabicName : item.name;
        const labelBelow = item.id === "jerusalem" || item.id === "hebron";
        const marker = (
          <g>
            {on && <circle cx={p.x} cy={p.y} r={9} fill="#FBBF24" opacity={0.25} />}
            <circle cx={p.x} cy={p.y} r={on ? 4.5 : 3} fill={on ? "#FBBF24" : "rgba(255,255,255,0.55)"} stroke="#3f412d" strokeWidth={1} />
            {(interactive || (on && !focus)) && (
              <text
                x={p.x}
                y={p.y + (labelBelow ? 17 : -9)}
                textAnchor="middle"
                fontSize={10}
                fontWeight={800}
                fill="#ffffff"
              >
                {name}
              </text>
            )}
          </g>
        );
        return interactive ? (
          <Link key={item.id} to={`/governorates/${item.id}`} aria-label={name} className="cursor-pointer [&_circle]:transition-all hover:[&_circle]:fill-[#FBBF24]">
            {marker}
          </Link>
        ) : (
          <React.Fragment key={item.id}>{marker}</React.Fragment>
        );
      })}
    </svg>
  );
};
