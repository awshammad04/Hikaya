import React, { useEffect, useState } from "react";
import { useInterfaceLanguage } from "../context/LanguageContext";
import type { Projector } from "./PalestineGeography";

/**
 * Real relief for a governorate map: hill shading, contour lines and the sea,
 * written by tools/generate-terrain.py from SRTM heights. Points are
 * [lat, lng]; the files live in public/terrain so they load with the map
 * instead of with every page.
 */
interface TerrainData {
  source: string;
  box: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  interval: number;
  lines: { m: number; i: number; p: [number, number][] }[];
  labels: { m: number; p: [number, number] }[];
  water: [number, number][][];
}

const loaded = new Map<string, Promise<TerrainData | null>>();

function loadTerrain(id: string) {
  if (!loaded.has(id)) {
    loaded.set(id, fetch(`/terrain/${encodeURIComponent(id)}.json`)
      .then((response) => (response.ok ? response.json() as Promise<TerrainData> : null))
      .catch(() => null));
  }
  return loaded.get(id)!;
}

/**
 * A smooth curve through the points: each sample is a control point and the
 * curve passes through the midpoints between them, so simplified contours
 * do not draw as straight segments.
 */
const path = (points: [number, number][], project: Projector, close = false) => {
  const p = points.map(([lat, lng]) => project(lat, lng));
  if (p.length < 3) return p.map((item, index) => `${index ? "L" : "M"}${item.x.toFixed(1)} ${item.y.toFixed(1)}`).join(" ");
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    `${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)}`;
  const at = (item: { x: number; y: number }) => `${item.x.toFixed(1)} ${item.y.toFixed(1)}`;
  const curves = p.slice(1, -1).map((item, index) => `Q${at(item)} ${mid(item, p[index + 2])}`);
  return `M${at(p[0])} L${mid(p[0], p[1])} ${curves.join(" ")} L${at(p[p.length - 1])}${close ? " Z" : ""}`;
};

interface TerrainLayerProps {
  id: string;
  project: Projector;
  zoom: number;
}

export const TerrainLayer: React.FC<TerrainLayerProps> = ({ id, project, zoom }) => {
  const { isArabic } = useInterfaceLanguage();
  const [terrain, setTerrain] = useState<{ id: string; data: TerrainData | null } | null>(null);

  useEffect(() => {
    let active = true;
    loadTerrain(id).then((data) => {
      if (active) setTerrain({ id, data });
    });
    return () => {
      active = false;
    };
  }, [id]);

  const data = terrain?.id === id ? terrain.data : null;
  if (!data) return null;

  const northWest = project(data.box.maxLat, data.box.minLng);
  const southEast = project(data.box.minLat, data.box.maxLng);
  const unit = isArabic ? "م" : "m";
  return (
    <g aria-hidden="true">
      <image
        href={`/terrain/${encodeURIComponent(id)}.png`}
        x={northWest.x}
        y={northWest.y}
        width={southEast.x - northWest.x}
        height={southEast.y - northWest.y}
        preserveAspectRatio="none"
        opacity={0.55}
      />
      {data.water.length > 0 && (
        <path
          d={data.water.map((ring) => path(ring, project, true)).join(" ")}
          fill="#b9cdd0"
          fillRule="evenodd"
          stroke="#7f9da3"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          opacity={0.85}
        />
      )}
      <g fill="none" stroke="#8a7550" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {data.lines.map((line, index) => (
          <path
            key={index}
            d={path(line.p, project)}
            strokeWidth={line.i ? 1.3 : 0.7}
            opacity={line.i ? 0.55 : 0.32}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      <g
        fontSize={10.5 / zoom}
        fontWeight={700}
        fill="#7a6644"
        stroke="#f1eadb"
        strokeWidth={3 / zoom}
        paintOrder="stroke"
        textAnchor="middle"
        opacity={0.85}
      >
        {data.labels.map((label) => {
          const p = project(label.p[0], label.p[1]);
          return (
            <text key={label.m} x={p.x} y={p.y} dominantBaseline="middle">
              {`${label.m} ${unit}`}
            </text>
          );
        })}
      </g>
    </g>
  );
};
