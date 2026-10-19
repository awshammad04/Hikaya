import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ApiContribution, ApiLocation } from "../types";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { markMemoryUncovered } from "../services/progress";
import { ArrowUpLeft, MessageSquareText, X } from "lucide-react";

interface MemoryConstellationProps {
  locations: ApiLocation[];
  memories: ApiContribution[];
}

const SIZE = 720;
const CENTRE = SIZE / 2;
const LOCATION_RADIUS = 210;
const CATEGORY_RADIUS = 92;

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "location" | "category" | "memory";
  locationId?: string;
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
    const categories: string[] = [...categorySet].sort();

    categories.forEach((category, index) => {
      const angle = (index / Math.max(categories.length, 1)) * Math.PI * 2 - Math.PI / 2;
      nodeList.push({
        id: `category:${category}`,
        label: category,
        x: CENTRE + Math.cos(angle) * CATEGORY_RADIUS,
        y: CENTRE + Math.sin(angle) * CATEGORY_RADIUS,
        kind: "category",
      });
    });

    locations.forEach((location, index) => {
      const angle =
        (index / Math.max(locations.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const x = CENTRE + Math.cos(angle) * LOCATION_RADIUS;
      const y = CENTRE + Math.sin(angle) * LOCATION_RADIUS;
      nodeList.push({
        id: `location:${location.id}`,
        label: isArabic ? (location.arabicName ?? location.name) : location.name,
        x,
        y,
        kind: "location",
        locationId: location.id,
      });

      location.categories.forEach((category) => {
        edgeList.push({
          from: `location:${location.id}`,
          to: `category:${category}`,
          kind: "category",
        });
      });

      // Memories orbit their own location, fanned outwards from the centre.
      const attached = memories.filter((memory) => memory.locationId === location.id);
      attached.forEach((memory, memoryIndex) => {
        const spread = ((memoryIndex - (attached.length - 1) / 2) * Math.PI) / 9;
        const memoryAngle = angle + spread;
        nodeList.push({
          id: `memory:${memory.id}`,
          label: memory.title,
          x: CENTRE + Math.cos(memoryAngle) * (LOCATION_RADIUS + 86),
          y: CENTRE + Math.sin(memoryAngle) * (LOCATION_RADIUS + 86),
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
    <div className="bg-white rounded-3xl border border-brand-border overflow-hidden">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
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

        <circle cx={CENTRE} cy={CENTRE} r={LOCATION_RADIUS} fill="url(#constellation-glow)" />

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
                x={node.x}
                y={node.y + 32}
                textAnchor="middle"
                className="fill-brand-olive"
                style={{ fontSize: 13, fontFamily: "Thmanyah Serif Display, serif", fontWeight: 700 }}
              >
                {node.label}
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
              <p className="text-[10px] uppercase tracking-widest text-brand-amber inline-flex items-center gap-1.5"><MessageSquareText className="w-3 h-3" />{isArabic ? "ذاكرة منشورة ومراجعة" : "Published, reviewed memory"}</p>
              <h3 className="font-serif font-black text-lg text-brand-olive">{selectedMemory.title}</h3>
            </div>
            <button type="button" onClick={() => setSelectedMemoryId(null)} className="p-1.5 text-brand-muted hover:text-brand-olive" aria-label={isArabic ? "إغلاق الذكرى" : "Close memory"}><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm leading-7 text-brand-text">{selectedMemory.content}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-amber/20 pt-2 text-[10px] text-brand-muted">
            <span>{selectedMemory.contributorName ?? (isArabic ? "مساهمة مجهولة الاسم" : "Anonymous contribution")}</span>
            {selectedLocation && <button type="button" onClick={() => navigate(`/locations/${selectedLocation.id}?tab=memories`)} className="font-bold text-brand-olive hover:text-brand-amber inline-flex items-center gap-1">{isArabic ? `افتح ${selectedLocation.arabicName ?? selectedLocation.name}` : `Open ${selectedLocation.name}`}<ArrowUpLeft className="w-3 h-3" /></button>}
          </div>
        </article>
      )}

      <div className="px-5 py-4 border-t border-brand-border-light flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[10px] font-mono text-brand-muted">
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
