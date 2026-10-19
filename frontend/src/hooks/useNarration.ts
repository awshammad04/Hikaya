import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WordTimestamp } from "../types";

export type NarrationMode = "natural" | "device";

type NaturalAudioError = Error & {
  code?: string;
  retryAfterSeconds?: number;
};

interface NaturalPlaybackSegment {
  /** AudioContext time at which this PCM chunk starts playing. */
  contextStart: number;
  /** Position of this chunk in the contiguous source audio. */
  audioStart: number;
  /** Duration of this chunk in source-audio seconds. */
  audioDuration: number;
  /** Duration after applying the selected playback rate. */
  contextDuration: number;
}

export interface NarrationState {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  loading: boolean;
  /** Current position in the source audio, in seconds. */
  currentTime: number | null;
  /** Exact word positions returned for the active natural narration. */
  timestamps: readonly WordTimestamp[];
  voices: SpeechSynthesisVoice[];
  selectedVoice: string;
  setSelectedVoice: (voiceUri: string) => void;
  naturalVoice: "Kore" | "Charon";
  setNaturalVoice: (voiceName: "Kore" | "Charon") => void;
  rate: number;
  setRate: (rate: number) => void;
  mode: NarrationMode;
  setMode: (mode: NarrationMode) => void;
  notice: string | null;
  speak: (text: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const NATURAL_VOICE_RANK = [
  "premium", "enhanced", "natural", "neural", "google", "microsoft",
  "laila", "layla", "hoda", "majed", "maged", "tarik", "samantha",
];

function rankVoice(voice: SpeechSynthesisVoice, language: "ar" | "en") {
  const name = voice.name.toLowerCase();
  let score = voice.lang.toLowerCase().startsWith(language) ? 100 : 0;
  NATURAL_VOICE_RANK.forEach((keyword, index) => {
    if (name.includes(keyword)) score += NATURAL_VOICE_RANK.length - index;
  });
  if (voice.localService) score += 2;
  return score;
}

function cleanForSpeech(text: string) {
  return text
    .replace(/[*#_`•]/g, " ")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/([،؛.!?؟])(?=\S)/g, "$1 ")
    .trim();
}

export function useNarration(language: "ar" | "en" = "ar"): NarrationState {
  const deviceSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const supported = typeof window !== "undefined" && ("Audio" in window || deviceSupported);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [timestamps, setTimestamps] = useState<WordTimestamp[]>([]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoiceState] = useState(() => window.localStorage.getItem("hikaya-quds.voice") ?? "");
  const [naturalVoice, setNaturalVoiceState] = useState<"Kore" | "Charon">(() => window.localStorage.getItem("hikaya-quds.natural-voice") === "Charon" ? "Charon" : "Kore");
  const [rate, setRateState] = useState(() => {
    const saved = Number(window.localStorage.getItem("hikaya-quds.narration-rate"));
    return [0.78, 0.88, 0.94, 1.05].includes(saved) ? saved : language === "ar" ? 0.88 : 0.94;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setModeState] = useState<NarrationMode>(() =>
    window.localStorage.getItem("hikaya-quds.narration-mode") === "device" ? "device" : "natural",
  );

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const naturalAbortRef = useRef<AbortController | null>(null);
  const naturalSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const naturalFirstPacketTimerRef = useRef<number | null>(null);
  const naturalPlaybackSegmentsRef = useRef<NaturalPlaybackSegment[]>([]);
  const naturalPlaybackRateRef = useRef(1);
  const operationRef = useRef(0);

  useEffect(() => {
    if (!speaking || paused) return;

    let frame = 0;
    const updatePlaybackTime = () => {
      const context = audioContextRef.current;
      const segments = naturalPlaybackSegmentsRef.current;
      if (context && segments.length > 0) {
        // Chunks can arrive too late to be scheduled without a gap. Resolve
        // the position within the actual chunk being played so buffering time
        // is never mistaken for spoken-audio time.
        let segmentIndex = segments.length - 1;
        while (
          segmentIndex >= 0
          && segments[segmentIndex].contextStart > context.currentTime
        ) {
          segmentIndex -= 1;
        }
        if (segmentIndex >= 0) {
          const segment = segments[segmentIndex];
          const elapsed = Math.min(
            segment.contextDuration,
            context.currentTime - segment.contextStart,
          );
          setCurrentTime(
            segment.audioStart + (elapsed * naturalPlaybackRateRef.current),
          );
        }
      }
      frame = window.requestAnimationFrame(updatePlaybackTime);
    };

    frame = window.requestAnimationFrame(updatePlaybackTime);
    return () => window.cancelAnimationFrame(frame);
  }, [paused, speaking]);

  useEffect(() => {
    if (!deviceSupported) return;
    const updateVoices = () => {
      const ordered = [...window.speechSynthesis.getVoices()].sort(
        (a, b) => rankVoice(b, language) - rankVoice(a, language),
      );
      setVoices(ordered);
      setSelectedVoiceState((current) => {
        if (current && ordered.some((voice) => voice.voiceURI === current)) return current;
        return ordered.find((voice) => voice.lang.toLowerCase().startsWith(language))?.voiceURI ?? ordered[0]?.voiceURI ?? "";
      });
    };
    updateVoices();
    window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", updateVoices);
  }, [deviceSupported, language]);

  const releaseAudio = useCallback(() => {
    naturalAbortRef.current?.abort();
    naturalAbortRef.current = null;
    if (naturalFirstPacketTimerRef.current !== null) {
      window.clearTimeout(naturalFirstPacketTimerRef.current);
      naturalFirstPacketTimerRef.current = null;
    }
    naturalSourcesRef.current.forEach((source) => {
      source.onended = null;
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
    });
    naturalSourcesRef.current.clear();
    if (audioContextRef.current) {
      void audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) {
      // Clearing src can emit an error. Remove every callback first so Stop
      // can never start another voice through a late error callback.
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.onloadedmetadata = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    naturalPlaybackSegmentsRef.current = [];
    naturalPlaybackRateRef.current = 1;
  }, []);

  const stop = useCallback(() => {
    operationRef.current += 1;
    if (deviceSupported) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
    releaseAudio();
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current = null;
    }
    setLoading(false);
    setSpeaking(false);
    setPaused(false);
    setCurrentTime(null);
    setTimestamps([]);
  }, [deviceSupported, releaseAudio]);

  useEffect(() => stop, [stop]);

  const speakWithDevice = useCallback((spoken: string, operationId: number) => {
    if (operationId !== operationRef.current) return;
    if (!deviceSupported) {
      setLoading(false);
      setSpeaking(false);
      setNotice(language === "ar" ? "لا يدعم هذا المتصفح صوت الجهاز." : "This browser does not support a device voice.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spoken);
    utterance.lang = language === "ar" ? "ar-SA" : "en-US";
    utterance.rate = rate;
    utterance.pitch = language === "ar" ? 0.98 : 1;
    utterance.volume = 1;
    utterance.voice = voices.find((voice) => voice.voiceURI === selectedVoice)
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith(language))
      ?? null;
    utterance.onend = () => {
      if (operationId !== operationRef.current) return;
      setSpeaking(false);
      setPaused(false);
      setCurrentTime(null);
      utteranceRef.current = null;
    };
    utterance.onerror = utterance.onend;
    utterance.onboundary = (event) => {
      if (operationId !== operationRef.current) return;
      setCurrentTime(event.elapsedTime);
    };
    utteranceRef.current = utterance;
    setLoading(false);
    setSpeaking(true);
    setPaused(false);
    setCurrentTime(0);
    window.speechSynthesis.speak(utterance);
  }, [deviceSupported, language, rate, selectedVoice, voices]);

  const speak = useCallback((text: string) => {
    stop();
    const operationId = operationRef.current;
    setNotice(null);
    const spoken = cleanForSpeech(text);
    if (mode === "device") {
      speakWithDevice(spoken, operationId);
      return;
    }

    const failNatural = (error: unknown) => {
      if (operationId !== operationRef.current) return;
      setLoading(false);
      setSpeaking(false);
      setPaused(false);
      setCurrentTime(null);
      releaseAudio();
      const failure = error as NaturalAudioError;
      const timedOut = failure.name === "AbortError";
      const quotaExceeded = failure.code === "quota_exceeded";
      const dailyQuotaExceeded = failure.code === "daily_quota_exceeded";
      const emptyStream = failure.code === "empty_stream";
      const retryAfter = Math.max(1, Math.ceil(failure.retryAfterSeconds ?? 60));
      setNotice(language === "ar"
        ? (dailyQuotaExceeded
            ? "اكتملت الحصة اليومية المجانية للصوت الطبيعي (10 طلبات). استخدم صوت الجهاز الآن، أو انتظر إعادة ضبط الحصة/فعّل الفوترة لمفتاح Gemini."
            : quotaExceeded
            ? `اكتملت حصة الصوت الطبيعي مؤقتاً. حاول مجدداً بعد نحو ${retryAfter} ثانية، أو اختر صوت الجهاز.`
            : timedOut
            ? "لم يكتمل تجهيز الصوت المتزامن خلال 60 ثانية. تحقق من الاتصال ثم أعد المحاولة، أو اختر صوت الجهاز."
            : emptyStream
            ? "انتهى بث الصوت من دون بيانات قابلة للتشغيل. أعد المحاولة أو اختر صوت الجهاز."
            : "الصوت الطبيعي غير متاح الآن. اختر «صوت الجهاز دون اتصال» إن أردت الاستماع فوراً.")
        : (dailyQuotaExceeded
            ? "The free daily natural-voice quota (10 requests) is exhausted. Use the device voice now, or wait for the quota reset/enable billing for the Gemini key."
            : quotaExceeded
            ? `The natural-voice rate limit is temporarily exhausted. Retry in about ${retryAfter} seconds, or choose the device voice.`
            : timedOut
            ? "Synchronized audio was not ready within 60 seconds. Check the connection and retry, or choose the device voice."
            : emptyStream
            ? "The voice stream ended without playable audio. Retry or choose the device voice."
            : "Natural audio is unavailable right now. Choose “Offline device voice” for immediate playback."));
    };

    setLoading(true);
    if (!("AudioContext" in window)) {
      const failure = new Error("Web Audio is unavailable") as NaturalAudioError;
      failure.code = "tts_unavailable";
      failNatural(failure);
      return;
    }
    let context: AudioContext;
    try {
      context = new AudioContext({ sampleRate: 24000 });
    } catch {
      context = new AudioContext();
    }
    const controller = new AbortController();
    audioContextRef.current = context;
    naturalAbortRef.current = controller;
    naturalFirstPacketTimerRef.current = window.setTimeout(() => controller.abort(), 60_000);
    void context.resume().catch(() => undefined);

    void (async () => {
      let pendingText = "";
      let receivedAudio = false;
      let streamFinished = false;
      let scheduledUntil = 0;
      let completed = false;
      const playbackRate = Math.min(1.05, Math.max(0.8, rate / 0.9));
      naturalPlaybackRateRef.current = playbackRate;

      const finishPlayback = () => {
        if (completed || operationId !== operationRef.current) return;
        completed = true;
        releaseAudio();
        setLoading(false);
        setSpeaking(false);
        setPaused(false);
        setCurrentTime(null);
      };

      const schedulePcm = (base64: string, sampleRate: number) => {
        if (operationId !== operationRef.current || context.state === "closed") return;
        const binary = window.atob(base64);
        const byteLength = binary.length - (binary.length % 2);
        if (byteLength === 0) return;
        const samples = new Float32Array(byteLength / 2);
        for (let byteIndex = 0, sampleIndex = 0; byteIndex < byteLength; byteIndex += 2, sampleIndex += 1) {
          const value = binary.charCodeAt(byteIndex) | (binary.charCodeAt(byteIndex + 1) << 8);
          const signed = value >= 0x8000 ? value - 0x10000 : value;
          samples[sampleIndex] = signed / 0x8000;
        }

        const buffer = context.createBuffer(1, samples.length, sampleRate || 24000);
        buffer.copyToChannel(samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = playbackRate;
        source.connect(context.destination);
        const startAt = Math.max(scheduledUntil, context.currentTime + 0.08);
        const previousSegment = naturalPlaybackSegmentsRef.current.at(-1);
        naturalPlaybackSegmentsRef.current.push({
          contextStart: startAt,
          audioStart: previousSegment
            ? previousSegment.audioStart + previousSegment.audioDuration
            : 0,
          audioDuration: buffer.duration,
          contextDuration: buffer.duration / playbackRate,
        });
        if (!receivedAudio) {
          receivedAudio = true;
          if (naturalFirstPacketTimerRef.current !== null) {
            window.clearTimeout(naturalFirstPacketTimerRef.current);
            naturalFirstPacketTimerRef.current = null;
          }
          setLoading(false);
          setSpeaking(true);
          setPaused(false);
          setCurrentTime(null);
        }
        scheduledUntil = startAt + (buffer.duration / playbackRate);
        naturalSourcesRef.current.add(source);
        source.onended = () => {
          naturalSourcesRef.current.delete(source);
          source.disconnect();
          if (streamFinished && naturalSourcesRef.current.size === 0) finishPlayback();
        };
        source.start(startAt);
      };

      const handleEvent = (event: Record<string, unknown>) => {
        if (event.type === "timestamps" && Array.isArray(event.timestamps)) {
          const next = event.timestamps.filter((item): item is WordTimestamp => {
            if (!item || typeof item !== "object") return false;
            const value = item as Record<string, unknown>;
            return typeof value.word === "string"
              && typeof value.start === "number"
              && typeof value.end === "number"
              && Number.isFinite(value.start)
              && Number.isFinite(value.end)
              && value.end > value.start;
          });
          setTimestamps(next);
          return;
        }
        if (event.type === "audio" && typeof event.data === "string") {
          schedulePcm(event.data, typeof event.sampleRate === "number" ? event.sampleRate : 24000);
          return;
        }
        if (event.type === "error") {
          const failure = new Error(typeof event.message === "string" ? event.message : "Natural voice unavailable") as NaturalAudioError;
          failure.code = typeof event.code === "string" ? event.code : "tts_unavailable";
          failure.retryAfterSeconds = typeof event.retryAfterSeconds === "number" ? event.retryAfterSeconds : undefined;
          throw failure;
        }
        if (event.type === "done") streamFinished = true;
      };

      try {
        const response = await fetch("/api/tts-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: spoken, voiceName: naturalVoice }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const failure = new Error("Natural voice unavailable") as NaturalAudioError;
          failure.code = "tts_unavailable";
          throw failure;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (operationId === operationRef.current) {
          const { value, done } = await reader.read();
          pendingText += decoder.decode(value, { stream: !done });
          const lines = pendingText.split("\n");
          pendingText = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) handleEvent(JSON.parse(line) as Record<string, unknown>);
          }
          if (done) break;
        }
        if (pendingText.trim()) handleEvent(JSON.parse(pendingText) as Record<string, unknown>);
        streamFinished = true;
        if (!receivedAudio) {
          const failure = new Error("Empty natural voice stream") as NaturalAudioError;
          failure.code = "empty_stream";
          throw failure;
        }
        if (naturalSourcesRef.current.size === 0 || context.currentTime >= scheduledUntil) finishPlayback();
      } catch (error) {
        if (operationId !== operationRef.current) return;
        failNatural(error);
      }
    })();
  }, [language, mode, naturalVoice, rate, releaseAudio, speakWithDevice, stop]);

  const pause = useCallback(() => {
    if (!speaking) return;
    if (audioContextRef.current) void audioContextRef.current.suspend();
    else if (audioRef.current) audioRef.current.pause();
    else if (deviceSupported) window.speechSynthesis.pause();
    setPaused(true);
  }, [deviceSupported, speaking]);

  const resume = useCallback(() => {
    if (audioContextRef.current) void audioContextRef.current.resume();
    else if (audioRef.current) void audioRef.current.play();
    else if (deviceSupported) window.speechSynthesis.resume();
    setPaused(false);
  }, [deviceSupported]);

  const setSelectedVoice = useCallback((voiceUri: string) => {
    setSelectedVoiceState(voiceUri);
    window.localStorage.setItem("hikaya-quds.voice", voiceUri);
  }, []);

  const setRate = useCallback((nextRate: number) => {
    setRateState(nextRate);
    window.localStorage.setItem("hikaya-quds.narration-rate", String(nextRate));
  }, []);

  const setNaturalVoice = useCallback((voiceName: "Kore" | "Charon") => {
    setNaturalVoiceState(voiceName);
    window.localStorage.setItem("hikaya-quds.natural-voice", voiceName);
  }, []);

  const setMode = useCallback((nextMode: NarrationMode) => {
    stop();
    setModeState(nextMode);
    setNotice(null);
    window.localStorage.setItem("hikaya-quds.narration-mode", nextMode);
  }, [stop]);

  return useMemo(() => ({
    supported, speaking, paused, loading, currentTime, timestamps, voices, selectedVoice,
    setSelectedVoice, naturalVoice, setNaturalVoice, rate, setRate, mode, setMode,
    notice, speak, pause, resume, stop,
  }), [supported, speaking, paused, loading, currentTime, timestamps, voices, selectedVoice, setSelectedVoice, naturalVoice, setNaturalVoice, rate, setRate, mode, setMode, notice, speak, pause, resume, stop]);
}
