import React, { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Pause, Play, SlidersHorizontal, Sparkles, Square, Volume2 } from "lucide-react";
import { useNarration } from "../hooks/useNarration";
import { markAudioListened } from "../services/progress";
import { useInterfaceLanguage } from "../context/LanguageContext";
import type { WordTimestamp } from "../types";
import { readableNarrative } from "../utils/plainText";
import { Select } from "./Select";

export type { WordTimestamp } from "../types";

export interface NarrativeReaderProps {
  text: string;
  /** Word-level positions in the narration audio, in reading order. */
  timestamps?: readonly WordTimestamp[];
  /** Reveal the text word by word, as if it were being written. */
  typing?: boolean;
  /** Offer the read-aloud controls. */
  narration?: boolean;
  /** Start reading aloud as soon as the text arrives (used by the walking tour). */
  autoPlay?: boolean;
  locationId?: string;
  /** Show only the listening controls; the text is rendered elsewhere. */
  controlsOnly?: boolean;
}

/** Returns the word being spoken at `currentTime`, or -1 during a gap. */
export function findActiveWordIndex(
  timestamps: readonly WordTimestamp[],
  currentTime: number | null,
) {
  if (currentTime === null || !Number.isFinite(currentTime) || currentTime < 0) {
    return -1;
  }

  // Timestamp arrays are ordered, so a binary search avoids scanning the
  // whole story on every animation frame.
  let low = 0;
  let high = timestamps.length - 1;
  let candidate = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (timestamps[middle].start <= currentTime) {
      candidate = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  if (candidate === -1) return -1;
  const timestamp = timestamps[candidate];
  return currentTime < timestamp.end ? candidate : -1;
}

/** Splits a narrative into paragraphs for the optional typewriter reveal. */
function tokenise(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  let running = 0;
  return paragraphs.map((paragraph) => {
    const lines = paragraph.split("\n").map((line) => {
      const words = line.split(/(\s+)/).filter((token) => token.length > 0);
      const entries = words.map((token) => {
        if (/^\s+$/.test(token)) return { token, index: -1 };
        const entry = { token, index: running };
        running += 1;
        return entry;
      });
      return entries;
    });
    return lines;
  });
}

/**
 * Short first lines without closing punctuation ("What to notice",
 * "Chronology:") are section headings in the reviewed stories.
 */
function isHeadingLine(line: string) {
  const text = line.trim();
  if (!text || text.startsWith("-") || text.length > 60) return false;
  if (text.split(/\s+/).length > 8) return false;
  return text.endsWith(":") || !/[.؟?!،,;؛…]$/.test(text);
}

/**
 * Displays a narrative, optionally revealing it as it is "written", with
 * independent read-aloud controls. When exact word timestamps are supplied,
 * highlighting follows the audio playback clock rather than a flat timer.
 */
export const NarrativeReader: React.FC<NarrativeReaderProps> = ({
  text: rawText,
  timestamps = [],
  typing = false,
  narration = true,
  autoPlay = false,
  locationId,
  controlsOnly = false,
}) => {
  const reduced = useReducedMotion();
  const { language, isArabic } = useInterfaceLanguage();
  const speech = useNarration(language);
  const deviceVoices = speech.voices.filter((voice) => voice.lang.toLowerCase().startsWith(language));
  // Either "natural" rate saved in the other language still reads as Natural.
  const naturalRate = speech.rate === 0.88 || speech.rate === 0.94 ? speech.rate : isArabic ? 0.88 : 0.94;
  // The same cleaned text is displayed and narrated, so word highlighting
  // stays aligned with the audio.
  const { text, headings } = useMemo(() => readableNarrative(rawText), [rawText]);
  const paragraphs = useMemo(() => tokenise(text), [text]);
  const totalWords = useMemo(
    () => text.split(/\s+/).filter(Boolean).length,
    [text],
  );
  const activeWordIndex = useMemo(
    () => speech.speaking
      ? findActiveWordIndex(
          speech.timestamps.length > 0 ? speech.timestamps : timestamps,
          speech.currentTime,
        )
      : -1,
    [speech.currentTime, speech.speaking, speech.timestamps, timestamps],
  );

  const [typedCount, setTypedCount] = useState(() =>
    typing && !reduced ? 0 : totalWords,
  );
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const autoPlayedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!speech.loading) {
      setLoadingSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setLoadingSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      250,
    );
    return () => window.clearInterval(timer);
  }, [speech.loading]);

  // Typewriter reveal. Word-at-a-time rather than character-at-a-time: a
  // character crawl on a 300-word narrative is a minute of waiting.
  useEffect(() => {
    if (!typing || reduced) {
      setTypedCount(totalWords);
      return;
    }
    setTypedCount(0);
    const interval = window.setInterval(() => {
      setTypedCount((current) => {
        if (current >= totalWords) {
          window.clearInterval(interval);
          return current;
        }
        return current + 2;
      });
    }, 28);
    return () => window.clearInterval(interval);
  }, [text, typing, reduced, totalWords]);

  useEffect(() => {
    if (!autoPlay || !narration || !speech.supported) return;
    if (autoPlayedFor.current === text) return;
    autoPlayedFor.current = text;
    setTypedCount(totalWords);
    speech.speak(text);
    if (locationId) markAudioListened(locationId);
  }, [autoPlay, narration, speech, text, totalWords, locationId]);

  const isTyping = typedCount < totalWords;
  return (
    <div className="space-y-4">
      {narration && speech.supported && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-border-light bg-brand-bg/60 p-2.5">
          {!speech.speaking && !speech.loading ? (
            <button
              type="button"
              onClick={() => {
                setTypedCount(totalWords);
                speech.speak(text);
                if (locationId) markAudioListened(locationId);
              }}
              className="bg-brand-olive hover:bg-brand-olive-deep text-white text-sm font-bold px-5 py-2 rounded-full inline-flex items-center gap-2 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              {isArabic ? "استمع للحكاية" : "Listen to the story"}
            </button>
          ) : speech.loading ? (
            <>
              <span className="text-xs text-brand-olive font-bold px-3 py-2 inline-flex items-center gap-2" role="status" aria-live="polite">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-brand-amber border-t-transparent animate-spin" />
                {isArabic ? `نحضّر صوتاً طبيعياً… ${loadingSeconds}ث` : `Preparing natural voice… ${loadingSeconds}s`}
              </span>
              <button
                type="button"
                onClick={speech.stop}
                className="border border-brand-border hover:border-brand-amber text-brand-olive text-xs font-mono uppercase tracking-wider px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition-colors"
              >
                <Square className="w-3 h-3" />
                {isArabic ? "إلغاء" : "Cancel"}
              </button>
              <span className="basis-full h-1 rounded-full bg-brand-border-light overflow-hidden" aria-hidden="true">
                <span className="block h-full w-1/2 rounded-full bg-brand-amber animate-pulse" />
              </span>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={speech.paused ? speech.resume : speech.pause}
                className="border border-brand-border hover:border-brand-amber text-brand-olive text-xs font-mono uppercase tracking-wider px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition-colors"
              >
                {speech.paused ? (
                  <Play className="w-3 h-3" />
                ) : (
                  <Pause className="w-3 h-3" />
                )}
                {speech.paused ? (isArabic ? "متابعة" : "Resume") : (isArabic ? "إيقاف مؤقت" : "Pause")}
              </button>
              <button
                type="button"
                onClick={speech.stop}
                className="border border-brand-border hover:border-brand-amber text-brand-olive text-xs font-mono uppercase tracking-wider px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition-colors"
              >
                <Square className="w-3 h-3" />
                {isArabic ? "إيقاف" : "Stop"}
              </button>
            </>
          )}

          {isTyping && (
            <button
              type="button"
              onClick={() => setTypedCount(totalWords)}
              className="text-xs font-mono uppercase tracking-wider text-brand-muted hover:text-brand-olive underline underline-offset-2"
            >
              {isArabic ? "أظهر النص كاملاً" : "Show it all"}
            </button>
          )}

          {!speech.speaking && !speech.loading && (
            <button
              type="button"
              onClick={() => setSettingsOpen((open) => !open)}
              aria-expanded={settingsOpen}
              className="ms-auto inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-brand-muted transition-colors hover:text-brand-olive"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isArabic ? "إعدادات الصوت" : "Voice settings"}
            </button>
          )}

          {settingsOpen && !speech.speaking && !speech.loading && (
            <div className="basis-full flex flex-wrap items-center gap-2 border-t border-brand-border-light pt-2.5">
              <Select
                size="sm"
                icon={<Sparkles className="w-3 h-3" />}
                value={speech.mode}
                onChange={(value) => speech.setMode(value as "natural" | "device")}
                aria-label={isArabic ? "نوع الصوت" : "Voice mode"}
                options={[
                  { value: "natural", label: isArabic ? "صوت الراوي" : "Narrator voice" },
                  { value: "device", label: isArabic ? "صوت الجهاز (دون إنترنت)" : "Device voice (offline)" },
                ]}
              />

              {speech.mode === "device" && deviceVoices.length > 0 && (
                <Select
                  size="sm"
                  className="max-w-48"
                  value={speech.selectedVoice}
                  onChange={speech.setSelectedVoice}
                  aria-label={isArabic ? "اختر صوت الجهاز" : "Choose device voice"}
                  placeholder={isArabic ? "صوت الجهاز" : "Device voice"}
                  searchable={deviceVoices.length > 8}
                  options={deviceVoices.map((voice) => ({ value: voice.voiceURI, label: voice.name }))}
                />
              )}

              {speech.mode === "natural" && (
                <Select
                  size="sm"
                  value={speech.naturalVoice}
                  onChange={(value) => speech.setNaturalVoice(value as "Kore" | "Charon")}
                  aria-label={isArabic ? "اختر نبرة المرشد" : "Choose guide voice"}
                  options={[
                    { value: "Kore", label: isArabic ? "ليلى" : "Layla", hint: isArabic ? "دافئة وواضحة" : "warm and clear" },
                    { value: "Charon", label: isArabic ? "سامي" : "Sami", hint: isArabic ? "هادئ وقصصي" : "calm storyteller" },
                  ]}
                />
              )}

              <span className="text-xs text-brand-muted inline-flex items-center gap-1.5">
                <span aria-hidden="true">{isArabic ? "السرعة" : "Speed"}</span>
                <Select
                  size="sm"
                  minPanelWidth={160}
                  value={String(speech.rate)}
                  onChange={(value) => speech.setRate(Number(value))}
                  aria-label={isArabic ? "سرعة القراءة" : "Reading speed"}
                  options={[
                    { value: "0.78", label: isArabic ? "هادئة" : "Slow" },
                    { value: String(naturalRate), label: isArabic ? "طبيعية" : "Natural" },
                    { value: "1.05", label: isArabic ? "سريعة" : "Fast" },
                  ]}
                />
              </span>
            </div>
          )}
        </div>
      )}

      {speech.notice && (
        <p className="text-xs text-brand-muted bg-brand-amber/10 border border-brand-amber/20 rounded-xl px-3 py-2" role="status">
          {speech.notice}
        </p>
      )}

      {!controlsOnly && <div
        className="mx-auto max-w-prose space-y-5 px-1 text-[15px] leading-[1.85] text-brand-text sm:px-3 sm:text-base"
        dir={isArabic ? "rtl" : "ltr"}
      >
        {paragraphs.map((lines, paragraphIndex) => {
          const firstLine = lines[0].map((entry) => entry.token).join("").trim();
          const headed = headings.has(firstLine) || (lines.length > 1 && isHeadingLine(firstLine));
          return (
          <p key={paragraphIndex} className="whitespace-pre-line" dir="auto">
            {lines.map((line, lineIndex) => {
              const words = line.map((entry, entryIndex) => {
                  if (entry.index === -1) {
                    return <React.Fragment key={entryIndex}>{entry.token}</React.Fragment>;
                  }
                  if (entry.index >= typedCount) return null;
                  const active = entry.index === activeWordIndex;
                  return (
                    <span
                      key={entryIndex}
                      data-word-index={entry.index}
                      data-active={active || undefined}
                      className={active
                        ? "rounded bg-brand-amber/25 text-brand-olive ring-1 ring-brand-amber/30 transition-colors duration-75"
                        : undefined}
                    >
                      {entry.token}
                    </span>
                  );
                });
              if (headed && lineIndex === 0) {
                return (
                  <span key={lineIndex} className="block mb-1 font-serif text-lg font-black text-brand-olive">
                    {words}
                  </span>
                );
              }
              return (
                <React.Fragment key={lineIndex}>
                  {lineIndex > 0 && !(headed && lineIndex === 1) && "\n"}
                  {words}
                </React.Fragment>
              );
            })}
            {/* Cursor, only on the paragraph currently being revealed. */}
            {isTyping && paragraphIndex === paragraphs.length - 1 && (
              <span className="inline-block w-1.5 h-4 bg-brand-amber align-middle animate-pulse ms-0.5" />
            )}
          </p>
          );
        })}
      </div>}

      {narration && !speech.supported && (
        <p className="text-xs font-mono text-brand-muted">
          {isArabic ? "القراءة الصوتية غير متاحة في هذا المتصفح." : "Read-aloud is not available in this browser."}
        </p>
      )}
    </div>
  );
};
