import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ApiContribution, ApiLocation } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { markMemoryUncovered } from "../services/progress";
import { ArrowUpLeft, MessageSquareText, X } from "lucide-react";
import { categoryLabel } from "../utils/categories";

interface MemoryConstellationProps {
  locations: ApiLocation[];
  memories: ApiContribution[];
}

// Wider than tall: place names run outwards to the left and right.
const WIDTH = 1000;
const HEIGHT = 760;
const CX = WIDTH / 2;
const CY = HEIGHT / 2;
const LOCATION_RADIUS = 240;
const CATEGORY_RADIUS = 125;
/** Names longer than this are shortened on the drawing; the full name stays in the tooltip. */
const LABEL_CHARS = 28;

const shorten = (label: string) =>
  label.length > LABEL_CHARS ? `${label.slice(0, LABEL_CHARS - 1).trimEnd()}…` : label;

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "location" | "category" | "memory";
  locationId?: string;
  /** Direction from the centre, used to set a place's name outside the ring. */
  angle?: number;
}

/**
 * Sets a place's name outside the ring, running away from the centre, so
 * neighbouring names sit one above the other instead of on top of each other.
 * The text is laid out left to right so "start" and "end" mean the same thing
 * for Arabic and English names.
 */
function labelPlacement(node: Node) {
  const cos = Math.cos(node.angle ?? Math.PI / 2);
  const sin = Math.sin(node.angle ?? Math.PI / 2);
  const x = node.x + cos * 22;
  const y = node.y + sin * 22;
  if (cos > 0.15) return { x, y: y + 4, textAnchor: "start" as const };
  if (cos < -0.15) return { x, y: y + 4, textAnchor: "end" as const };
  return { x, y: sin < 0 ? y - 2 : y + 10, textAnchor: "middle" as const };
}

/**
 * The archive drawn as a web rather than a list.
 *
 * Locations sit on the outer ring, the categories they share sit in the middle,
 * and every published memory hangs off the place it belongs to. The edges are
 * real relationships from the data - a shared category, or a contribution
 * attached to a site - not decoration, so the shape of the picture says
 * something true: where the archive is dense, and where it is thin.
 *
 * The layout is deterministic (evenly spaced by index), which keeps it stable
 * between renders and avoids a physics simulation for a graph this size.
 */
export const MemoryConstellation: React.FC<MemoryConstellationProps> = ({
  locations,
  memories,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const reduced = useReducedMotion();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const nodeList: Node[] = [];
    const edgeList: { from: string; to: string; kind: "category" | "memory" }[] = [];

    const categorySet = new Set<string>();
    locations.forEach((location) =>
      location.categories.forEach((category) => categorySet.add(category)),
    );
    const sortedCategories: string[] = [...categorySet].sort();

    // Places that share a primary theme sit next to each other on the ring,
    // and each theme is placed towards its places, so edges stay short and
    // cross less often than with alphabetical placement.
    const primaryRank = (location: ApiLocation) =>
      Math.min(...location.categories.map((category) => sortedCategories.indexOf(category)), sortedCategories.length);
    const ordered = [...locations].sort((a, b) => primaryRank(a) - primaryRank(b) || a.id.localeCompare(b.id));
    const ringAngle = (index: number) => (index / Math.max(ordered.length, 1)) * Math.PI * 2 - Math.PI / 2;

    const meanAngle = (category: string) => {
      let sin = 0;
      let cos = 0;
      ordered.forEach((location, index) => {
        if (!location.categories.includes(category)) return;
        sin += Math.sin(ringAngle(index));
        cos += Math.cos(ringAngle(index));
      });
      return Math.atan2(sin, cos);
    };
    const means = new Map(sortedCategories.map((category) => [category, meanAngle(category)]));
    const categories = [...sortedCategories].sort((a, b) => means.get(a)! - means.get(b)!);
    const step = (Math.PI * 2) / Math.max(categories.length, 1);
    // Rotate the evenly spaced theme ring to sit as close as it can to the means.
    const offset = Math.atan2(
      categories.reduce((total, category, index) => total + Math.sin(means.get(category)! - index * step), 0),
      categories.reduce((total, category, index) => total + Math.cos(means.get(category)! - index * step), 0),
    );

    categories.forEach((category, index) => {
      const angle = offset + index * step;
      nodeList.push({
        id: `category:${category}`,
        label: categoryLabel(category, isArabic),
        x: CX + Math.cos(angle) * CATEGORY_RADIUS,
        y: CY + Math.sin(angle) * CATEGORY_RADIUS,
        kind: "category",
      });
    });

    ordered.forEach((location, index) => {
      const angle = ringAngle(index);
      const x = CX + Math.cos(angle) * LOCATION_RADIUS;
      const y = CY + Math.sin(angle) * LOCATION_RADIUS;
      nodeList.push({
        id: `location:${location.id}`,
        label: isArabic ? (location.arabicName ?? location.name) : location.name,
        x,
        y,
        kind: "location",
        locationId: location.id,
        angle,
      });

      location.categories.forEach((category) => {
        edgeList.push({
          from: `location:${location.id}`,
          to: `category:${category}`,
          kind: "category",
        });
      });

      // Memories sit just inside their own location, leaving the outside of
      // the ring free for the place names.
      const attached = memories.filter((memory) => memory.locationId === location.id);
      attached.forEach((memory, memoryIndex) => {
        const spread = ((memoryIndex - (attached.length - 1) / 2) * Math.PI) / 40;
        const memoryAngle = angle + spread;
        nodeList.push({
          id: `memory:${memory.id}`,
          label: memory.title,
          x: CX + Math.cos(memoryAngle) * (LOCATION_RADIUS - 46),
          y: CY + Math.sin(memoryAngle) * (LOCATION_RADIUS - 46),
          kind: "memory",
          locationId: location.id,
        });
        edgeList.push({
          from: `location:${location.id}`,
          to: `memory:${memory.id}`,
          kind: "memory",
        });
      });
    });

    return { nodes: nodeList, edges: edgeList };
  }, [isArabic, locations, memories]);

  const byId = useMemo(() => {
    const index: Record<string, Node> = {};
    nodes.forEach((node) => {
      index[node.id] = node;
    });
    return index;
  }, [nodes]);

  const isDimmed = (nodeId: string) => {
    if (!hovered) return false;
    if (nodeId === hovered) return false;
    const node = byId[nodeId];
    const active = byId[hovered];
    if (!node || !active) return true;
    // Keep everything attached to the hovered location lit.
    return !(
      node.locationId &&
      active.locationId &&
      node.locationId === active.locationId
    );
  };
  const selectedMemory = memories.find((memory) => memory.id === selectedMemoryId) ?? null;
  const selectedLocation = selectedMemory
    ? locations.find((location) => location.id === selectedMemory.locationId)
    : null;
  const openMemory = (memoryId: string) => {
    setSelectedMemoryId(memoryId);
    markMemoryUncovered(memoryId);
  };

  return (
    <div className="bg-brand-surface rounded-3xl border border-brand-border overflow-hidden">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={isArabic ? "الأرشيف مرسوماً شبكة من الأماكن والتصنيفات والذكريات" : "The archive drawn as a web of locations, categories and memories"}
      >
        <defs>
          <radialGradient id="constellation-glow">
            <stop offset="0%" stopColor="#D97706" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={LOCATION_RADIUS} fill="url(#constellation-glow)" />

        {edges.map((edge, index) => {
          const from = byId[edge.from];
          const to = byId[edge.to];
          if (!from || !to) return null;
          const dimmed = isDimmed(edge.from) && isDimmed(edge.to);
          return (
            <motion.line
              key={index}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={edge.kind === "memory" ? "#D97706" : "#5A5A40"}
              strokeWidth={edge.kind === "memory" ? 1 : 1.5}
              strokeOpacity={dimmed ? 0.08 : edge.kind === "memory" ? 0.4 : 0.25}
              strokeDasharray={edge.kind === "memory" ? "3 4" : undefined}
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : index * 0.02 }}
            />
          );
        })}

        {nodes.map((node, index) => {
          const dimmed = isDimmed(node.id);
          const opacity = dimmed ? 0.25 : 1;

          if (node.kind === "category") {
            return (
              <g key={node.id} opacity={opacity}>
                <circle cx={node.x} cy={node.y} r={5} fill="#8a8a80" />
                <text
                  x={node.x}
                  y={node.y - 11}
                  textAnchor="middle"
                  className="fill-brand-muted"
                  style={{ fontSize: 10, fontFamily: "Thmanyah Sans, sans-serif" }}
                >
                  {node.label}
                </text>
              </g>
            );
          }

          if (node.kind === "memory") {
            const memoryId = node.id.replace(/^memory:/, "");
            return (
              <g
                key={node.id}
                opacity={opacity}
                role="button"
                tabIndex={0}
                aria-label={isArabic ? `افتح الذكرى: ${node.label}` : `Open memory: ${node.label}`}
                className="cursor-pointer focus:outline-none"
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(node.id)}
                onBlur={() => setHovered(null)}
                onClick={() => openMemory(memoryId)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openMemory(memoryId);
                  }
                }}
              >
                <circle cx={node.x} cy={node.y} r={13} fill="transparent" />
                <circle cx={node.x} cy={node.y} r={4} fill="#D97706" />
                <title>{node.label}</title>
              </g>
            );
          }

          return (
            <motion.g
              key={node.id}
              opacity={opacity}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              aria-label={isArabic ? `افتح ${node.label}` : `Open ${node.label}`}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => navigate(`/locations/${node.locationId}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(`/locations/${node.locationId}`);
                }
              }}
              initial={{ scale: reduced ? 1 : 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : index * 0.05 }}
              style={{ transformOrigin: `${node.x}px ${node.y}px` }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={13}
                fill="#5A5A40"
                stroke="#f5f5f0"
                strokeWidth={3}
              />
              <text
                {...labelPlacement(node)}
                className="fill-brand-olive"
                style={{ fontSize: 13, fontFamily: "Thmanyah Serif Display, serif", fontWeight: 700, direction: "ltr" }}
              >
                {shorten(node.label)}
              </text>
              <title>{node.label}</title>
            </motion.g>
          );
        })}
      </svg>

      {selectedMemory && (
        <article className="mx-4 mb-4 rounded-2xl border border-brand-amber/30 bg-brand-amber/5 p-4 space-y-2" dir={isArabic ? "rtl" : "ltr"} aria-live="polite">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-amber inline-flex items-center gap-1.5"><MessageSquareText className="w-3 h-3" />{isArabic ? "ذاكرة منشورة ومراجعة" : "Published, reviewed memory"}</p>
              <h3 className="font-serif font-black text-lg text-brand-olive">{selectedMemory.title}</h3>
            </div>
            <button type="button" onClick={() => setSelectedMemoryId(null)} className="p-1.5 text-brand-muted hover:text-brand-olive" aria-label={isArabic ? "إغلاق الذكرى" : "Close memory"}><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm leading-7 text-brand-text">{selectedMemory.content}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-amber/20 pt-2 text-xs text-brand-muted">
            <span>{selectedMemory.contributorName ?? (isArabic ? "مساهمة مجهولة الاسم" : "Anonymous contribution")}</span>
            {selectedLocation && <button type="button" onClick={() => navigate(`/locations/${selectedLocation.id}?tab=memories`)} className="font-bold text-brand-olive hover:text-brand-amber inline-flex items-center gap-1">{isArabic ? `افتح ${selectedLocation.arabicName ?? selectedLocation.name}` : `Open ${selectedLocation.name}`}<ArrowUpLeft className="w-3 h-3" /></button>}
          </div>
        </article>
      )}

      <div className="px-5 py-4 border-t border-brand-border-light flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-mono text-brand-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-brand-olive" />
          {isArabic ? "مكان — اضغط لفتحه" : "Location — click to open"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-muted" />
          {isArabic ? "تصنيف مشترك" : "Shared category"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-brand-amber" />
          {isArabic ? `ذكرى منشورة (${memories.length})` : `Published memory (${memories.length})`}
        </span>
      </div>
    </div>
  );
};
