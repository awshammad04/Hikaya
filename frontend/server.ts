import express from "express";
import path from "path";
import fs from "fs";
import net from "net";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import AdmZip from "adm-zip";
import { locations } from "./src/locationsData";
import { backendUrl, installProductionControls, isProduction } from "./production";

dotenv.config();

const app = express();
// 5173 by default so the frontend does not collide with the Hikaya backend,
// which serves the API on 3000.
const PORT = Number(process.env.PORT ?? 5173);
const HIKAYA_API_UPSTREAM = backendUrl();
const API_PROXY_TIMEOUT_MS = Number(process.env.API_PROXY_TIMEOUT_MS || 180000);
if (!Number.isInteger(API_PROXY_TIMEOUT_MS) || API_PROXY_TIMEOUT_MS < 1000) throw new Error("Invalid API_PROXY_TIMEOUT_MS");
installProductionControls(app);
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Body parser
app.use(express.json({ limit: isProduction ? "8mb" : "50mb" }));
app.use(express.urlencoded({ limit: isProduction ? "8mb" : "50mb", extended: true }));

/**
 * Same-origin API bridge.
 *
 * The browser always talks to the host that served the page (`/api/v1`). The
 * server can safely reach the Nest API over loopback, so phones never need to
 * know the computer's changing Wi-Fi address and never hit CORS restrictions.
 */
app.use("/api/v1", async (req, res) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_PROXY_TIMEOUT_MS);

  try {
    const method = req.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD" && req.body !== undefined;
    const upstream = await fetch(`${HIKAYA_API_UPSTREAM}${req.url}`, {
      method,
      signal: controller.signal,
      headers: {
        accept: req.get("accept") ?? "application/json",
        "content-type": req.get("content-type") ?? "application/json",
        "x-hikaya-internal-token": process.env.HIKAYA_INTERNAL_TOKEN || "",
        // Account sessions ride on an HttpOnly cookie set by the API; the
        // client address lets the API throttle password guessing per visitor.
        ...(req.get("cookie") ? { cookie: req.get("cookie")! } : {}),
        "x-forwarded-for": req.ip ?? "",
      },
      body: hasBody ? JSON.stringify(req.body) : undefined,
    });

    const contentType = upstream.headers.get("content-type");
    const retryAfter = upstream.headers.get("retry-after");
    const cacheControl = upstream.headers.get("cache-control");
    const setCookies = upstream.headers.getSetCookie();
    if (retryAfter) res.setHeader("Retry-After", retryAfter);
    if (contentType) res.setHeader("Content-Type", contentType);
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
    const payload = Buffer.from(await upstream.arrayBuffer());
    return res.status(upstream.status).send(payload);
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    console.error(
      `[Hikaya API proxy] ${timedOut ? "upstream timed out" : "upstream unavailable"}:`,
      error,
    );
    return res.status(502).json({
      message: timedOut
        ? "The Hikaya API did not respond in time."
        : "The Hikaya API is temporarily unavailable.",
    });
  } finally {
    clearTimeout(timer);
  }
});

interface LegacyContribution {
  id: string;
  location: string;
  title: string;
  author: string;
  narrative: string;
  imageUrl: string;
  videoUrl: string;
  category: string;
  date: string;
}

// Compatibility store for the retired Explorer endpoint. It deliberately has
// no fabricated seed memories; the active contribution flow uses the reviewed
// NestJS moderation API and its offline Jerusalem-only repository.
const userContributions: LegacyContribution[] = [];

// Lazy Gemini client helper.
//
// As of the 2026 key rotation, "Get API key" in AI Studio issues Vertex AI
// Express-mode keys (prefixed "AQ.") instead of the old Developer API keys
// (prefixed "AIza"). Express keys only authenticate against Vertex AI
// (vertexai: true) - sent to the classic Developer API host they come back
// as a 401 ACCESS_TOKEN_TYPE_UNSUPPORTED, as if no credential was sent at
// all. `vertexai: true` needs no project/location in Express mode; the SDK
// still takes the same model names and call shapes either way.
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY in the AI Studio Settings > Secrets panel.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      vertexai: process.env.GEMINI_API_MODE === "vertex" || (!process.env.GEMINI_API_MODE && apiKey.startsWith("AQ.")),
      httpOptions: {
        timeout: 120000,
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// Compatibility endpoint for the former Explorer narrator. It now delegates to
// the same reviewed-content and fact-guarded backend used by StoryWizard.
app.post("/api/generate-story", async (req, res) => {
  const { locationName, targetAudience, language, storyTone } = req.body;
  try {
    if (!locationName) {
      return res.status(400).json({ error: "locationName is required." });
    }

    const location = locations.find((item) => item.name === locationName || item.arabicName === locationName);
    if (!location) return res.status(404).json({ error: "Reviewed Jerusalem location not found." });

    const audienceText = String(targetAudience ?? "general").toLowerCase();
    const targetMode = audienceText.includes("child") || audienceText.includes("young")
      ? "child"
      : audienceText.includes("student")
      ? "student"
      : audienceText.includes("histor")
      ? "historian"
      : audienceText.includes("tour") || audienceText.includes("visitor")
      ? "tourist"
      : audienceText.includes("brief") || audienceText.includes("short")
      ? "short"
      : "general";
    const requestedTone = String(storyTone ?? "storytelling").toLowerCase();
    const tone = requestedTone.includes("educat")
      ? "educational"
      : requestedTone.includes("warm") || requestedTone.includes("emotion")
      ? "emotional"
      : requestedTone.includes("plain") || requestedTone.includes("neutral")
      ? "neutral"
      : "storytelling";
    const response = await fetch(`${HIKAYA_API_UPSTREAM}/ai/generate-story`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hikaya-internal-token": process.env.HIKAYA_INTERNAL_TOKEN || "" },
      signal: AbortSignal.timeout(API_PROXY_TIMEOUT_MS),
      body: JSON.stringify({
        locationId: location.id,
        targetAudience: targetMode,
        language: String(language).toLowerCase().startsWith("ar") ? "ar" : "en",
        tone,
        persist: false,
      }),
    });
    const data = await response.json();
    if (!response.ok || !data.narrative) {
      return res.status(response.status || 503).json({ error: data.message ?? "Reviewed story generation failed." });
    }
    return res.json({ narrative: data.narrative, sources: [], generatedBy: data.generatedBy });
  } catch (error: any) {
    console.error("Reviewed story generation error:", error);
    return res.status(503).json({ error: isProduction ? "Reviewed story generation is unavailable." : error.message });
  }
});

// 2. API: Generate Text-To-Speech Narration
function pcmToWavBase64(base64Pcm: string, sampleRate = 24000): string {
  const pcm = Buffer.from(base64Pcm, "base64");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
}

interface TtsPayload {
  base64Audio: string;
  mimeType: string;
  pcmBase64: string;
  sampleRate: number;
  timestamps?: WordTimestamp[];
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface WordAnnotation {
  type?: string;
  text?: string;
  start_offset?: string;
  end_offset?: string;
}

interface TranscriptionInteraction {
  steps?: Array<{
    content?: Array<{
      annotations?: WordAnnotation[];
    }>;
  }>;
}

const TTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TTS_CACHE_LIMIT = 12;
const TTS_DISK_CACHE_DIR = path.join(process.cwd(), ".cache", "tts");
const ttsCache = new Map<string, { payload: TtsPayload; expiresAt: number }>();
const ttsInFlight = new Map<string, Promise<TtsPayload>>();

function ttsKey(text: string, voiceName: string) {
  return createHash("sha256").update(`${voiceName}\u0000${text}`).digest("hex");
}

function cachedTts(key: string) {
  const entry = ttsCache.get(key);
  if (entry) {
    if (entry.expiresAt <= Date.now()) {
      ttsCache.delete(key);
    } else {
      ttsCache.delete(key);
      ttsCache.set(key, entry);
      return entry.payload;
    }
  }

  try {
    const cachePath = path.join(TTS_DISK_CACHE_DIR, `${key}.json`);
    const stat = fs.statSync(cachePath);
    if (Date.now() - stat.mtimeMs > TTS_CACHE_TTL_MS) return null;
    const payload = JSON.parse(fs.readFileSync(cachePath, "utf8")) as TtsPayload;
    if (!payload.pcmBase64 || !payload.base64Audio || !payload.sampleRate) return null;
    ttsCache.set(key, { payload, expiresAt: Date.now() + TTS_CACHE_TTL_MS });
    return payload;
  } catch {
    return null;
  }
}

function rememberTts(key: string, payload: TtsPayload) {
  ttsCache.delete(key);
  ttsCache.set(key, { payload, expiresAt: Date.now() + TTS_CACHE_TTL_MS });
  while (ttsCache.size > TTS_CACHE_LIMIT) {
    const oldest = ttsCache.keys().next().value;
    if (oldest === undefined) break;
    ttsCache.delete(oldest);
  }
  // Persist generated narration so a development-server restart does not burn
  // another preview-model request or make the visitor wait again.
  void fs.promises.mkdir(TTS_DISK_CACHE_DIR, { recursive: true })
    .then(() => fs.promises.writeFile(
      path.join(TTS_DISK_CACHE_DIR, `${key}.json`),
      JSON.stringify(payload),
      { mode: 0o600 },
    ))
    .catch((error) => console.warn("Could not persist TTS cache:", error));
}

function offsetSeconds(value: string | undefined) {
  if (!value) return Number.NaN;
  return Number.parseFloat(value.replace(/s$/i, ""));
}

function normalizedWord(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[\p{P}\p{S}\p{M}]/gu, "");
}

/**
 * Match recognized words back to the displayed tokens. TTS normally recites
 * them one-for-one; the look-ahead handles punctuation and formatted numbers
 * without shifting every later highlight.
 */
function alignRecognizedWords(text: string, recognized: WordTimestamp[]) {
  const expected = text.split(/\s+/).filter(Boolean);
  if (expected.length === 0 || recognized.length === 0) return [];

  if (expected.length === recognized.length) {
    return expected.map((word, index) => ({ ...recognized[index], word }));
  }

  const aligned: Array<WordTimestamp | undefined> = new Array(expected.length);
  let expectedIndex = 0;
  let recognizedIndex = 0;
  while (expectedIndex < expected.length && recognizedIndex < recognized.length) {
    const expectedWord = normalizedWord(expected[expectedIndex]);
    const spokenWord = normalizedWord(recognized[recognizedIndex].word);
    if (expectedWord && expectedWord === spokenWord) {
      aligned[expectedIndex] = { ...recognized[recognizedIndex], word: expected[expectedIndex] };
      expectedIndex += 1;
      recognizedIndex += 1;
      continue;
    }

    const laterSpoken = recognized.slice(recognizedIndex + 1, recognizedIndex + 7)
      .findIndex((item) => normalizedWord(item.word) === expectedWord);
    const laterExpected = expected.slice(expectedIndex + 1, expectedIndex + 7)
      .findIndex((item) => normalizedWord(item) === spokenWord);
    if (laterSpoken >= 0 && (laterExpected < 0 || laterSpoken <= laterExpected)) {
      recognizedIndex += laterSpoken + 1;
    } else if (laterExpected >= 0) {
      expectedIndex += laterExpected + 1;
    } else {
      aligned[expectedIndex] = { ...recognized[recognizedIndex], word: expected[expectedIndex] };
      expectedIndex += 1;
      recognizedIndex += 1;
    }
  }

  // Rare unrecognized tokens get only the small interval between neighboring
  // exact annotations; recognized words retain their actual audio offsets.
  let cursor = 0;
  while (cursor < aligned.length) {
    if (aligned[cursor]) {
      cursor += 1;
      continue;
    }
    const gapStart = cursor;
    while (cursor < aligned.length && !aligned[cursor]) cursor += 1;
    const gapEnd = cursor;
    const start = gapStart > 0 ? aligned[gapStart - 1]!.end : 0;
    const end = gapEnd < aligned.length
      ? aligned[gapEnd]!.start
      : recognized.at(-1)!.end;
    const duration = Math.max(0, end - start);
    const count = gapEnd - gapStart;
    for (let index = gapStart; index < gapEnd; index += 1) {
      aligned[index] = {
        word: expected[index],
        start: start + (duration * (index - gapStart)) / count,
        end: start + (duration * (index - gapStart + 1)) / count,
      };
    }
  }
  return aligned as WordTimestamp[];
}

async function addWordTimestamps(text: string, payload: TtsPayload, key: string) {
  if (payload.timestamps?.length) return payload;

  const ai = getAI();
  const wav = Buffer.from(payload.base64Audio, "base64");
  const uploaded = await ai.files.upload({
    file: new Blob([wav], { type: "audio/wav" }),
    config: { mimeType: "audio/wav", displayName: "hikaya-narration.wav" },
  });

  try {
    if (!uploaded.uri) throw new Error("The narration upload did not return a URI.");
    // The installed SDK's generated types lag the transcription endpoint, so
    // keep this narrow cast until transcription_config is included upstream.
    const interaction = await ai.interactions.create({
      model: "gemini-3.5-transcribe",
      input: [{ type: "audio", uri: uploaded.uri, mime_type: "audio/wav" }],
      generation_config: {
        transcription_config: {
          mode: { type: "verbatim", timestamp_granularities: ["word"] },
        },
      },
    } as Parameters<typeof ai.interactions.create>[0]) as unknown as TranscriptionInteraction;

    const recognized = (interaction.steps ?? []).flatMap((step) =>
      (step.content ?? []).flatMap((content) => content.annotations ?? []),
    ).filter((annotation) => annotation.type === "word_info")
      .map((annotation) => ({
        word: annotation.text ?? "",
        start: offsetSeconds(annotation.start_offset),
        end: offsetSeconds(annotation.end_offset),
      }))
      .filter((timestamp) =>
        timestamp.word
        && Number.isFinite(timestamp.start)
        && Number.isFinite(timestamp.end)
        && timestamp.end > timestamp.start,
      );

    const timestamps = alignRecognizedWords(text, recognized);
    if (timestamps.length === 0) throw new Error("Transcription returned no word timestamps.");
    const aligned = { ...payload, timestamps };
    rememberTts(key, aligned);
    return aligned;
  } finally {
    if (uploaded.name) {
      void ai.files.delete({ name: uploaded.name }).catch(() => undefined);
    }
  }
}

function naturalTtsDirection(text: string) {
  const isArabic = /[\u0600-\u06ff]/.test(text);
  return isArabic
    ? "اقرأ النص العربي كما يرويه مرشد مقدسي: بنبرة إنسانية دافئة، وإيقاع طبيعي، ووقفات واضحة، ومن دون مبالغة مسرحية. انطق أسماء الأماكن العربية كما كُتبت."
    : "Read as a warm, natural Jerusalem guide. Use a conversational pace, clear pauses, and understated emotion.";
}

function generateNaturalTts(
  text: string,
  selectedVoice: string,
  key: string,
) {
  const existing = ttsInFlight.get(key);
  if (existing) return existing;

  const task = (async (): Promise<TtsPayload> => {
    const ai = getAI();
    const direction = naturalTtsDirection(text);
    // Vertex AI Express-mode keys (the "AQ." keys AI Studio now issues,
    // required since the 2026 key rotation) authenticate fine against
    // generateContent but are rejected on generateContentStream with a
    // misleading "expected OAuth" 401 - a known gap in that method, not an
    // invalid-key problem. The code below already buffers the full response
    // before returning anything, so calling the non-streaming method costs
    // nothing here.
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `${direction}\n\n${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const pcmChunks: Buffer[] = [];
    let sampleRate = 24000;
    let sourceMime = "audio/L16;rate=24000";
    const audioParts = response.candidates?.[0]?.content?.parts?.filter(
      (part) => Boolean(part.inlineData?.data),
    ) ?? [];
    for (const part of audioParts) {
      const audioPart = part.inlineData!;
      sourceMime = audioPart.mimeType || sourceMime;
      sampleRate = Number(sourceMime.match(/rate=(\d+)/i)?.[1] ?? sampleRate);
      const pcm = Buffer.from(audioPart.data!, "base64");
      if (pcm.length === 0) continue;
      pcmChunks.push(pcm);
    }

    if (pcmChunks.length === 0) throw new Error("Failed to generate TTS audio stream.");
    const pcm = Buffer.concat(pcmChunks);
    const needsWavHeader = /audio\/(?:l16|pcm|raw)/i.test(sourceMime);
    const payload = {
      base64Audio: needsWavHeader ? pcmToWavBase64(pcm.toString("base64"), sampleRate) : pcm.toString("base64"),
      mimeType: needsWavHeader ? "audio/wav" : sourceMime,
      pcmBase64: pcm.toString("base64"),
      sampleRate,
    };
    rememberTts(key, payload);
    return payload;
  })().finally(() => ttsInFlight.delete(key));

  ttsInFlight.set(key, task);
  return task;
}

function ttsErrorDetails(error: any) {
  const rawMessage = typeof error?.message === "string" ? error.message : String(error);
  const quotaExceeded = error?.status === 429 || /quota|resource_exhausted|429/i.test(rawMessage);
  const dailyQuotaExceeded = quotaExceeded && /PerDay|per day|requests per day/i.test(rawMessage);
  const retryMatch = rawMessage.match(/retry in\s+([\d.]+)s/i)
    ?? rawMessage.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
  const retryAfterSeconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : 60;
  return {
    quotaExceeded,
    dailyQuotaExceeded,
    retryAfterSeconds,
    code: dailyQuotaExceeded ? "daily_quota_exceeded" : quotaExceeded ? "quota_exceeded" : "tts_unavailable",
    message: dailyQuotaExceeded
      ? "The free-tier daily natural-voice quota is exhausted."
      : quotaExceeded
      ? "The natural-voice rate limit is temporarily exhausted."
      : "The natural-voice service is temporarily unavailable.",
  };
}

function writeCachedPcm(
  res: express.Response,
  payload: TtsPayload,
  writeEvent: (event: Record<string, unknown>) => void,
) {
  const pcm = Buffer.from(payload.pcmBase64, "base64");
  // Keeping events reasonably small lets the browser decode and schedule them
  // without blocking the main thread when a cached narration is replayed.
  for (let offset = 0; offset < pcm.length; offset += 48 * 1024) {
    writeEvent({
      type: "audio",
      data: pcm.subarray(offset, offset + 48 * 1024).toString("base64"),
      sampleRate: payload.sampleRate,
    });
  }
}

app.post("/api/tts-stream", async (req, res) => {
  const { text, voiceName } = req.body;
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required." });
  }
  if (text.length > 12_000) {
    return res.status(413).json({ error: "Narration text is too long." });
  }

  const selectedVoice = voiceName === "Charon" ? "Charon" : "Kore";
  const key = ttsKey(text, selectedVoice);
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let connected = true;
  // The request stream closes as soon as its JSON body has been consumed;
  // only the response closing means the listening browser actually left.
  res.on("close", () => { connected = false; });
  const writeEvent = (event: Record<string, unknown>) => {
    if (connected && !res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
  };

  try {
    const cached = cachedTts(key);
    if (cached) {
      writeEvent({ type: "ready", cache: "HIT" });
      const aligned = await addWordTimestamps(text, cached, key);
      writeEvent({ type: "timestamps", timestamps: aligned.timestamps });
      writeCachedPcm(res, aligned, writeEvent);
      writeEvent({ type: "done" });
      return res.end();
    }

    const existing = ttsInFlight.get(key);
    if (existing) {
      writeEvent({ type: "ready", cache: "COALESCED" });
      const payload = await addWordTimestamps(text, await existing, key);
      writeEvent({ type: "timestamps", timestamps: payload.timestamps });
      writeCachedPcm(res, payload, writeEvent);
    } else {
      writeEvent({ type: "ready", cache: "MISS" });
      const payload = await addWordTimestamps(
        text,
        await generateNaturalTts(text, selectedVoice, key),
        key,
      );
      writeEvent({ type: "timestamps", timestamps: payload.timestamps });
      writeCachedPcm(res, payload, writeEvent);
    }
    writeEvent({ type: "done" });
    return res.end();
  } catch (error: any) {
    console.error("Streaming TTS Generation Error:", error);
    const details = ttsErrorDetails(error);
    writeEvent({ type: "error", ...details });
    return res.end();
  }
});

app.post("/api/tts", async (req, res) => {
  const { text, voiceName } = req.body;
  try {
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required." });
    }
    if (text.length > 12_000) {
      return res.status(413).json({ error: "Narration text is too long." });
    }

    const selectedVoice = voiceName === "Charon" ? "Charon" : "Kore";
    const key = ttsKey(text, selectedVoice);
    const cached = cachedTts(key);
    if (cached) {
      res.setHeader("X-Hikaya-TTS-Cache", "HIT");
      return res.json(await addWordTimestamps(text, cached, key));
    }

    res.setHeader("X-Hikaya-TTS-Cache", ttsInFlight.has(key) ? "COALESCED" : "MISS");
    return res.json(await addWordTimestamps(
      text,
      await generateNaturalTts(text, selectedVoice, key),
      key,
    ));
  } catch (error: any) {
    console.error("TTS Generation Error:", error);
    const details = ttsErrorDetails(error);
    if (details.quotaExceeded && !details.dailyQuotaExceeded) res.setHeader("Retry-After", String(details.retryAfterSeconds));
    return res.status(details.quotaExceeded ? 429 : 503).json({
      useNativeSpeech: true,
      code: details.code,
      retryAfterSeconds: details.quotaExceeded && !details.dailyQuotaExceeded ? details.retryAfterSeconds : undefined,
      message: details.message,
    });
  }
});

// 3. API: Generate Video from Text or Image using Veo
app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, imageBase64, aspectRatio } = req.body;
    if ((prompt !== undefined && (typeof prompt !== "string" || prompt.length > 4000)) ||
        (imageBase64 !== undefined && (typeof imageBase64 !== "string" || imageBase64.length > 7_000_000))) {
      return res.status(400).json({ error: "Invalid video prompt or image." });
    }
    const ai = getAI();

    const selectedPrompt = prompt || "Cinematic aerial view of ancient stone arches and olive orchards in Palestine, warm sunset, 4k, photorealistic";
    const selectedRatio = aspectRatio === "9:16" ? "9:16" : "16:9";

    let payload: any = {
      model: "veo-3.1-fast-generate-preview",
      prompt: selectedPrompt,
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: selectedRatio,
      },
    };

    // If base64 image is uploaded, support image-to-video animation
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      payload.image = {
        imageBytes: cleanBase64,
        mimeType: "image/png",
      };
    }

    console.log("Starting Veo Video generation...");
    const operation = await ai.models.generateVideos(payload);
    
    return res.json({ operationName: operation.name });
  } catch (error: any) {
    if (isProduction) return res.status(503).json({ error: "Video generation is temporarily unavailable." });
    console.error("Video Generation Error, activating beautiful scenic fallback operation:", error);
    return res.json({ 
      operationName: "fallback-operation-scenic", 
      isFallback: true,
      message: error.message || "Veo API rate limit reached." 
    });
  }
});

// 4. API: Check Video Status
app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required." });
    }

    if (typeof operationName !== "string" || operationName.length > 512) return res.status(400).json({ error: "Invalid operation name." });

    if (operationName === "fallback-operation-scenic") {
      if (isProduction) return res.status(400).json({ error: "Invalid production operation." });
      return res.json({ done: true });
    }

    const ai = getAI();
    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    return res.json({ done: updated.done });
  } catch (error: any) {
    console.error("Video Status Error:", error);
    if (isProduction) return res.status(503).json({ error: "Video status is temporarily unavailable." });
    return res.json({ done: true, isFallback: true });
  }
});

// 5. API: Stream/Download Video
app.post("/api/video-download", async (req, res) => {
  const fallbackVideoUrl = "https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-thick-green-forest-41132-large.mp4";
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "operationName is required." });
    }

    if (typeof operationName !== "string" || operationName.length > 512) return res.status(400).json({ error: "Invalid operation name." });

    if (operationName === "fallback-operation-scenic") {
      if (isProduction) return res.status(400).json({ error: "Invalid production operation." });
      try {
        const videoRes = await fetch(fallbackVideoUrl);
        if (videoRes.ok) {
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Content-Disposition", "attachment; filename=\"scenic-palestine.mp4\"");
          const arrayBuffer = await videoRes.arrayBuffer();
          return res.send(Buffer.from(arrayBuffer));
        }
      } catch (fetchErr) {
        console.error("Scenic fetch failed, redirecting:", fetchErr);
      }
      return res.redirect(fallbackVideoUrl);
    }

    const ai = getAI();
    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await ai.operations.getVideosOperation({ operation: op });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.status(404).json({ error: "Video URI not found on the completed operation." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const videoUrl = new URL(uri);
    if (videoUrl.protocol !== "https:" || !["generativelanguage.googleapis.com", "storage.googleapis.com", "aiplatform.googleapis.com"].includes(videoUrl.hostname) && !videoUrl.hostname.endsWith(".aiplatform.googleapis.com")) {
      throw new Error("Unexpected video download host.");
    }
    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey || "" },
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    });

    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video stream from Google storage. Status: ${videoRes.status}`);
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=\"hikaya-memory.mp4\"");

    // Stream it back to client
    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.send(buffer);
  } catch (error: any) {
    if (isProduction) return res.status(503).json({ error: "Video download is temporarily unavailable." });
    console.error("Video Download Error, streaming high-quality fallback video instead:", error);
    try {
      const videoRes = await fetch(fallbackVideoUrl);
      if (videoRes.ok) {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", "attachment; filename=\"scenic-palestine-fallback.mp4\"");
        const arrayBuffer = await videoRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch (e) {
      // ignore
    }
    return res.redirect(fallbackVideoUrl);
  }
});

// 6. API: Add User Memory Contribution
app.post("/api/contribute", async (req, res) => {
  const { location, title, author, narrative, imageUrl, videoUrl, category } = req.body;
  if (!location || !title || !narrative || !author) {
    return res.status(400).json({ error: "Location, title, author, and narrative are required." });
  }
  const reviewedLocation = locations.find((item) => item.id === location || item.name === location || item.arabicName === location);
  if (!reviewedLocation) return res.status(400).json({ error: "Choose a reviewed Jerusalem location." });
  if (isProduction) {
    try {
      const upstream = await fetch(`${HIKAYA_API_UPSTREAM}/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hikaya-internal-token": process.env.HIKAYA_INTERNAL_TOKEN || "" },
        signal: AbortSignal.timeout(API_PROXY_TIMEOUT_MS),
        body: JSON.stringify({ locationId: reviewedLocation.id, title, content: narrative, contributorName: author,
          mediaUrl: imageUrl || videoUrl || undefined, mediaType: imageUrl ? "image" : videoUrl ? "video" : undefined }),
      });
      return res.status(upstream.status).json(await upstream.json());
    } catch {
      return res.status(503).json({ error: "Your contribution could not be saved. Please try again." });
    }
  }

  const newContribution = {
    id: `contribution-${Date.now()}`,
    location: reviewedLocation.id,
    title,
    author,
    narrative,
    imageUrl: imageUrl || "",
    videoUrl: videoUrl || "",
    category: category || "Personal Memories",
    date: new Date().toISOString().split("T")[0]
  };

  userContributions.unshift(newContribution);
  return res.json({ success: true, contribution: newContribution });
});

// 7. API: Fetch All Contributions
app.get("/api/contributions", async (req, res) => {
  if (isProduction) {
    try {
      const upstream = await fetch(`${HIKAYA_API_UPSTREAM}/contributions`, {
        headers: { "x-hikaya-internal-token": process.env.HIKAYA_INTERNAL_TOKEN || "" },
        signal: AbortSignal.timeout(API_PROXY_TIMEOUT_MS),
      });
      return res.status(upstream.status).json(await upstream.json());
    } catch { return res.status(503).json({ error: "Contributions are temporarily unavailable." }); }
  }
  return res.json(userContributions);
});

// 8. API: Pack and Download Project ZIP (Frontend & Code Files)
app.get("/api/download-zip", (req, res) => {
  if (isProduction) return res.status(404).json({ error: "Not found." });
  try {
    const zip = new AdmZip();
    const workspaceRoot = process.cwd();

    // Include files and directories recursively
    const itemsToZip = [
      "src",
      "public",
      "package.json",
      "package-lock.json",
      "vite.config.ts",
      "tsconfig.json",
      "index.html",
      "metadata.json",
      ".env.example",
      ".gitignore",
      "server.ts",
      "README.md",
      "branding",
      "scripts"
    ];

    itemsToZip.forEach(item => {
      const fullPath = path.join(workspaceRoot, item);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          zip.addLocalFolder(fullPath, item);
        } else {
          zip.addLocalFile(fullPath);
        }
      }
    });

    const zipBuffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=\"hikaya.zip\"");
    return res.send(zipBuffer);
  } catch (error: any) {
    console.error("ZIP Generation Error:", error);
    return res.status(500).json({ error: "Failed to compile the project zip code folder." });
  }
});

// Create a professional README file in the workspace if it doesn't exist
const readmePath = path.join(process.cwd(), "README.md");
if (!fs.existsSync(readmePath)) {
  const readmeContent = "# Hikaya — Palestinian Heritage Guide\n\n" +
    "A focused, offline-ready visitor guide to Jerusalem's Palestinian quarters, neighbourhoods, gates, markets and living memories.\n\n" +
    "## Core Features\n" +
    "1. Interactive Jerusalem Map: An offline illustrated map of the Old City and its surrounding Palestinian neighbourhoods.\n" +
    "2. Fact-guarded Storytelling: Audience-specific narratives are composed only from reviewed Hikaya source records.\n" +
    "3. Voice Narration (TTS): Fully integrated audio guides for landmarks using Gemini 3.1 Flash Text-to-Speech.\n" +
    "4. Veo 3 Video Experience: Enables text-to-video loops and starting image-to-video cinematic loops with Veo 3.1 Fast Generate Preview.\n" +
    "5. Crowdsourced Living Archive: Interactive form for citizens and visitors to contribute personal memories, traditions, photos, and generated videos.\n" +
    "6. Code Export Utility: Click-to-download complete, compiled frontend and backend source tree inside a production-ready ZIP archive directly from the UI.\n\n" +
    "## Technology Stack\n" +
    "- Frontend: React.js 19, Vite 6, Tailwind CSS 4, Motion React (Animations), Lucide React (Icons), @vis.gl/react-google-maps.\n" +
    "- Backend/API Proxy: Node.js Express Server, @google/genai SDK, adm-zip packager.\n\n" +
    "## Quick Start\n" +
    "1. Add your GEMINI_API_KEY and GOOGLE_MAPS_PLATFORM_KEY to your environment variables (or AI Studio Secrets).\n" +
    "2. Install dependencies: npm install\n" +
    "3. Run the development server: npm run dev\n";
  fs.writeFileSync(readmePath, readmeContent);
}

// Serve Vite build in production, or mount Vite middleware in development
const isProd = isProduction;
app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));
if (!isProd) {
  import("vite").then(async (viteModule) => {
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use((req, res, next) => {
    if (/\.(?:cjs|map)$/i.test(req.path)) return res.status(404).end();
    next();
  });
  app.use(express.static(distPath, { dotfiles: "deny" }));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

/** Can something already be reached on this host and port? */
function isInUse(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 700 });
    const done = (inUse: boolean) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

/**
 * Is this port genuinely free on every address `localhost` might resolve to?
 *
 * Checked by *connecting*, not by binding, because binding does not detect the
 * case that actually bites here. Another dev server holding `[::1]:5173` and
 * this one binding the wildcard both succeed - macOS allows a wildcard bind
 * alongside a specific-address bind - and then the more specific listener wins
 * every `localhost` request, because macOS resolves `localhost` to `::1` first.
 * The result is this server logging "running on localhost:5173" while the
 * browser is served somebody else's project entirely.
 *
 * Both loopback families are probed: whichever one `localhost` lands on has to
 * be ours, or the address printed below is a lie.
 */
async function isPortAvailable(port: number): Promise<boolean> {
  const busy = await Promise.all([
    isInUse("127.0.0.1", port),
    isInUse("::1", port),
  ]);
  return !busy.some(Boolean);
}

async function resolvePort(preferred: number, attempts = 10): Promise<number> {
  for (let candidate = preferred; candidate < preferred + attempts; candidate += 1) {
    if (await isPortAvailable(candidate)) {
      if (candidate !== preferred) {
        console.warn(
          `[Hikaya Server] Port ${preferred} is already in use - using ${candidate} instead.`,
        );
      }
      return candidate;
    }
  }
  throw new Error(
    `Ports ${preferred}-${preferred + attempts - 1} are all in use. ` +
      `Free one, or set PORT in frontend/.env.`,
  );
}

void (async () => {
  const port = isProduction ? PORT : await resolvePort(PORT);

  // No host argument: Node binds dual-stack, so `localhost` reaches this
  // server whether it resolves to 127.0.0.1 or ::1.
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`[Hikaya Server] Running on http://localhost:${port}`);
  });
  process.on("SIGTERM", () => server.close(() => process.exit(0)));
})();
