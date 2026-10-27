import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useInterfaceLanguage } from "../context/LanguageContext";

export interface SelectOption {
  value: string;
  label: string;
  /** Muted text after the label, in the list and on the closed field. */
  hint?: string;
  /** Other words that should find this option, such as its name in the other language. */
  keywords?: string;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

/**
 * Folds the differences a visitor should not have to type: case, Latin
 * accents, Arabic short vowels and tatweel, and the hamza and ta marbuta
 * spellings, so "اريحا" finds "أريحا" and "turkiye" finds "Türkiye".
 */
export const foldForSearch = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯـً-ٰٟ]/g, "")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();

const GAP = 6;
const EDGE = 12;

/**
 * Places a popup under its field, or above it when there is more room there.
 * Fixed coordinates in a portal, so a scrolling dialog or an overflow-hidden
 * card cannot clip it; it follows the field while the page scrolls.
 */
function usePopupPosition(
  open: boolean,
  anchor: React.RefObject<HTMLElement | null>,
  popup: React.RefObject<HTMLElement | null>,
  minWidth: number,
  maxHeight: number,
) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);
  const [side, setSide] = useState<"top" | "bottom">("bottom");

  useLayoutEffect(() => {
    if (!open) return;
    const place = (event?: Event) => {
      if (event?.target instanceof Node && popup.current?.contains(event.target)) return;
      const field = anchor.current;
      if (!field) return;
      const rect = field.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportWidth = document.documentElement.clientWidth;
      const below = viewportHeight - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      const upward = below < Math.min(maxHeight, 240) && above > below;
      const width = Math.min(Math.max(rect.width, minWidth), viewportWidth - EDGE * 2);
      const start = getComputedStyle(field).direction === "rtl" ? rect.right - width : rect.left;
      setSide(upward ? "top" : "bottom");
      setStyle({
        position: "fixed",
        left: Math.min(Math.max(EDGE, start), viewportWidth - width - EDGE),
        width,
        maxHeight: Math.max(140, Math.min(maxHeight, upward ? above : below)),
        ...(upward ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [open, anchor, popup, minWidth, maxHeight]);

  return { style: style ?? { position: "fixed" as const, visibility: "hidden" as const }, side };
}

const panelClass =
  "popup-panel z-[90] flex flex-col overflow-hidden rounded-2xl border border-brand-border bg-brand-surface text-brand-text shadow-xl shadow-black/10";

const optionClass = (active: boolean, selected: boolean, compact: boolean) =>
  `flex cursor-pointer items-center gap-2.5 rounded-xl px-3 ${compact ? "py-2" : "py-2.5"} text-sm leading-snug transition-colors ${
    active ? "bg-brand-bg" : ""
  } ${selected ? "font-bold text-brand-olive" : "text-brand-text"}`;

interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Flat options, or `groups` for a list under headings. */
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
  /** A filter box above the list, for lists too long to scan. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** `sm` is the pill used in toolbars; `md` matches the form fields. */
  size?: "md" | "sm";
  /** Shown before the value on the closed field. */
  icon?: React.ReactNode;
  /** Replaces the value on the closed field (the phone picker shows only flag and code). */
  renderValue?: (option: SelectOption) => React.ReactNode;
  minPanelWidth?: number;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * A dropdown in the site's own style, in place of the browser's grey system
 * menu. It keeps what the native one does well: arrow keys, Home/End, Enter,
 * Escape, jumping by first letter, and focus back on the field after a choice.
 * On a touch screen the search box is not focused on open, so the keyboard
 * does not slide up over the list before the visitor asks for it.
 */
export const Select: React.FC<SelectProps> = ({
  id,
  value,
  onChange,
  options,
  groups,
  placeholder,
  searchable = false,
  searchPlaceholder,
  emptyText,
  size = "md",
  icon,
  renderValue,
  minPanelWidth = 220,
  className = "",
  disabled,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
}) => {
  const { isArabic } = useInterfaceLanguage();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [paper, setPaper] = useState(false);
  const { style, side } = usePopupPosition(open, triggerRef, panelRef, minPanelWidth, 340);
  const compact = size === "sm";

  const allGroups = useMemo<SelectGroup[]>(
    () => groups ?? [{ label: "", options: options ?? [] }],
    [groups, options],
  );

  const selected = useMemo(() => {
    for (const group of allGroups) {
      const option = group.options.find((item) => item.value === value);
      if (option) return { option, group: group.label };
    }
    return null;
  }, [allGroups, value]);

  // A governorate's name finds all of its places, not only those that repeat it.
  const visible = useMemo(() => {
    const needle = foldForSearch(query);
    if (!needle) return allGroups;
    return allGroups
      .map((group) =>
        foldForSearch(group.label).includes(needle)
          ? group
          : {
              ...group,
              options: group.options.filter((option) =>
                foldForSearch(`${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`).includes(needle),
              ),
            },
      )
      .filter((group) => group.options.length);
  }, [allGroups, query]);
  const flat = useMemo(() => visible.flatMap((group) => group.options), [visible]);
  const optionId = (index: number) => `${listId}-option-${index}`;

  const scrollToOption = (index: number, center = false) => {
    const list = listRef.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!list || !item) return;
    if (center) {
      list.scrollTop = item.offsetTop - (list.clientHeight - item.offsetHeight) / 2;
      return;
    }
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop - 6;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight + 6;
  };

  const openList = () => {
    if (disabled) return;
    setPaper(Boolean(triggerRef.current?.closest(".paper-scope")));
    setOpen(true);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  };

  const choose = (option: SelectOption) => {
    onChange(option.value);
    close(true);
  };

  // On open: highlight the current choice, centre it, and focus the search
  // box (with a mouse) or the list itself (on touch).
  useEffect(() => {
    if (!open) return;
    const index = allGroups.flatMap((group) => group.options).findIndex((option) => option.value === value);
    setActive(index);
    const frame = requestAnimationFrame(() => {
      const finePointer = window.matchMedia?.("(pointer: fine)").matches ?? true;
      (searchable && finePointer ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
      scrollToOption(index, true);
    });
    return () => cancelAnimationFrame(frame);
    // Only on opening; after that the keyboard and the pointer move the highlight.
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const move = (to: number) => {
    if (!flat.length) return;
    const next = Math.max(0, Math.min(flat.length - 1, to));
    setActive(next);
    scrollToOption(next);
  };

  const onPanelKeyDown = (event: React.KeyboardEvent) => {
    const inSearch = event.target === searchRef.current;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(active + 1);
        return;
      case "ArrowUp":
        event.preventDefault();
        move(active - 1);
        return;
      case "PageDown":
        event.preventDefault();
        move(active + 8);
        return;
      case "PageUp":
        event.preventDefault();
        move(active - 8);
        return;
      case "Home":
      case "End":
        if (inSearch) return;
        event.preventDefault();
        move(event.key === "Home" ? 0 : flat.length - 1);
        return;
      case "Enter":
        event.preventDefault();
        if (flat[active]) choose(flat[active]);
        return;
      case " ":
        if (inSearch) return;
        event.preventDefault();
        if (flat[active]) choose(flat[active]);
        return;
      case "Escape":
        // Closes the list only, not the dialog the field sits in.
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        event.preventDefault();
        close(true);
        return;
    }
    if (!inSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const letter = foldForSearch(event.key);
      for (let step = 1; step <= flat.length; step += 1) {
        const index = (active + step) % flat.length;
        if (foldForSearch(flat[index].label).startsWith(letter)) {
          move(index);
          return;
        }
      }
    }
  };

  const triggerSize = compact
    ? "rounded-full bg-brand-surface px-3 py-1.5 text-xs gap-1.5"
    : "w-full rounded-xl bg-brand-bg px-4 py-2.5 text-sm gap-2.5";
  const context = selected && !renderValue && !compact ? selected.option.hint ?? selected.group : "";
  let counter = 0;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openList();
          }
        }}
        className={`inline-flex items-center border text-start transition-[border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 ${triggerSize} ${
          open ? "border-brand-amber ring-4 ring-brand-amber/15" : "border-brand-border hover:border-brand-amber/60"
        } ${className}`}
      >
        {icon && (
          <span aria-hidden="true" className="inline-flex shrink-0 text-brand-amber">
            {icon}
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate ${
            selected ? (compact ? "font-bold text-brand-olive" : "text-brand-text") : "text-brand-muted"
          }`}
        >
          {selected ? (renderValue ? renderValue(selected.option) : selected.option.label) : placeholder}
        </span>
        {context && (
          <span dir="auto" className="max-w-[40%] shrink-0 truncate text-xs text-brand-muted">
            {context}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={`shrink-0 transition-transform ${compact ? "h-3.5 w-3.5" : "h-4 w-4"} ${
            open ? "rotate-180 text-brand-amber" : "text-brand-muted"
          }`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={style}
            data-side={side}
            onKeyDown={onPanelKeyDown}
            className={`${panelClass} ${paper ? "paper-scope" : ""}`}
          >
            {searchable && (
              <div className="flex items-center gap-2 border-b border-brand-border-light px-3.5">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-muted" />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={flat[active] ? optionId(active) : undefined}
                  aria-label={searchPlaceholder ?? (isArabic ? "ابحث" : "Search")}
                  placeholder={searchPlaceholder ?? (isArabic ? "ابحث…" : "Search…")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                    if (listRef.current) listRef.current.scrollTop = 0;
                  }}
                  autoComplete="off"
                  spellCheck={false}
                  className="popup-search min-w-0 flex-1 bg-transparent py-3 text-sm text-brand-text placeholder:text-brand-muted"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActive(0);
                      searchRef.current?.focus();
                    }}
                    aria-label={isArabic ? "امسح البحث" : "Clear search"}
                    className="rounded-full p-1 text-brand-muted hover:text-brand-olive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabel ? undefined : ariaLabelledby ?? id}
              aria-activedescendant={!searchable && flat[active] ? optionId(active) : undefined}
              className="popup-list relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
            >
              {flat.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-brand-muted">
                  {emptyText ?? (isArabic ? "لا توجد نتائج" : "No matches")}
                </p>
              )}
              {visible.map((group, groupIndex) => (
                <div
                  key={group.label || groupIndex}
                  role={group.label ? "group" : undefined}
                  aria-labelledby={group.label ? `${listId}-group-${groupIndex}` : undefined}
                >
                  {group.label && (
                    <div
                      id={`${listId}-group-${groupIndex}`}
                      className="flex items-center justify-between gap-2 px-3 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-widest text-brand-muted"
                    >
                      <span>{group.label}</span>
                      <span aria-hidden="true" className="font-normal tabular-nums">{group.options.length}</span>
                    </div>
                  )}
                  {group.options.map((option) => {
                    const index = counter++;
                    const isSelected = option.value === value;
                    return (
                      <div
                        key={option.value}
                        id={optionId(index)}
                        data-index={index}
                        role="option"
                        aria-selected={isSelected}
                        onMouseMove={() => index !== active && setActive(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                        className={optionClass(index === active, isSelected, compact)}
                      >
                        <span className="min-w-0 flex-1">{option.label}</span>
                        {option.hint && (
                          <span dir="auto" className="shrink-0 text-xs font-normal text-brand-muted">
                            {option.hint}
                          </span>
                        )}
                        <Check
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 text-brand-amber ${isSelected ? "" : "invisible"}`}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
};

interface ComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  maxLength?: number;
  /** Classes for the text box itself. */
  className?: string;
  /** Shown before each suggestion. */
  optionIcon?: React.ReactNode;
}

/**
 * A text box with suggestions in the site's style, in place of a native
 * `<datalist>`: the visitor can type anything, or pick a suggestion with the
 * pointer or the arrow keys.
 */
export const Combobox: React.FC<ComboboxProps> = ({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  maxLength,
  className = "",
  optionIcon,
}) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [paper, setPaper] = useState(false);

  const matches = useMemo(() => {
    const needle = foldForSearch(value);
    return Array.from(new Set<string>(suggestions)).filter((suggestion) => {
      const folded = foldForSearch(suggestion);
      return folded.includes(needle) && folded !== needle;
    });
  }, [suggestions, value]);
  const showing = open && matches.length > 0;
  const { style, side } = usePopupPosition(showing, inputRef, panelRef, 0, 280);

  const show = () => {
    setPaper(Boolean(inputRef.current?.closest(".paper-scope")));
    setOpen(true);
  };

  const pick = (suggestion: string) => {
    onChange(suggestion);
    setOpen(false);
    setActive(-1);
  };

  const step = (by: number) => {
    if (!showing) {
      show();
      return;
    }
    const next = Math.max(0, Math.min(matches.length - 1, active + by));
    setActive(next);
    panelRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showing}
        aria-controls={showing ? listId : undefined}
        aria-activedescendant={showing && matches[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(-1);
          show();
        }}
        onFocus={show}
        onClick={show}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            step(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            step(-1);
          } else if (event.key === "Enter" && showing && matches[active]) {
            event.preventDefault();
            pick(matches[active]);
          } else if (event.key === "Escape" && showing) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        className={className}
      />
      {showing &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            style={style}
            data-side={side}
            className={`${panelClass} popup-list overflow-y-auto overscroll-contain p-1.5 ${paper ? "paper-scope" : ""}`}
          >
            {matches.map((suggestion, index) => (
              <div
                key={suggestion}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === active}
                onMouseMove={() => index !== active && setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(suggestion)}
                className={optionClass(index === active, false, true)}
              >
                {optionIcon && (
                  <span aria-hidden="true" className="inline-flex shrink-0 text-brand-amber">
                    {optionIcon}
                  </span>
                )}
                <span className="min-w-0 flex-1">{suggestion}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
};
