import React from "react";
import { useInterfaceLanguage } from "../context/LanguageContext";

export interface TabDefinition {
  id: string;
  label: string;
  icon?: React.ElementType;
  /** Shown as a small count next to the label. */
  badge?: number;
}

interface TabsProps {
  tabs: TabDefinition[];
  active: string;
  onChange: (id: string) => void;
}

/**
 * Horizontal tab bar.
 *
 * Implements the roving-tabindex keyboard pattern: arrow keys move between
 * tabs, and only the active one is in the tab order, so the keyboard does not
 * have to walk through every tab to reach the panel.
 */
export const Tabs: React.FC<TabsProps> = ({ tabs, active, onChange }) => {
  const { isArabic } = useInterfaceLanguage();
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={isArabic ? "أقسام المكان" : "Location sections"}
      className="flex flex-wrap items-center gap-1 border-b border-brand-border-light overflow-x-auto"
    >
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={`pb-3 pt-1 px-3 whitespace-nowrap text-xs font-serif font-bold uppercase tracking-widest border-b-2 transition-colors inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-amber rounded-t ${
              selected
                ? "border-brand-olive text-brand-olive"
                : "border-transparent text-brand-muted hover:text-brand-olive"
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="text-[9px] font-mono text-brand-amber">{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export const TabPanel: React.FC<{
  id: string;
  active: string;
  children: React.ReactNode;
}> = ({ id, active, children }) =>
  id === active ? (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className="pt-6 focus:outline-none"
    >
      {children}
    </div>
  ) : null;
