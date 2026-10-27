/**
 * Natural narration: Gemini text-to-speech streamed to the browser.
 *
 * The text is split at sentence boundaries into short pieces. Each piece is
 * synthesised with streaming, so the first sound arrives in about a second
 * instead of after the whole story has been rendered, and the browser plays
 * the pieces back to back. Word timings for highlighting come from a separate
 * transcription of each finished piece, shifted by the piece's start time. If
 * that call fails the timings are estimated from word lengths: highlighting
 * gets a little less exact, but the audio is never thrown away.
 */
import type express from "express";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { GoogleGenAI } from "@google/genai";

type GeminiMode = "developer" | "vertex";

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface CachedPiece {
  pcmBase64: string;
  sampleRate: number;
  /** Only transcription results are cached; estimates are recomputed. */
  timestamps?: WordTimestamp[];
}

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts";
const TRANSCRIBE_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL || "gemini-3.5-transcribe";
const MAX_NARRATION_CHARS = 12_000;
/** The first piece is short so playback starts quickly; later ones are longer. */
const FIRST_PIECE_CHARS = 320;
const PIECE_CHARS = 900;
const TIMING_TIMEOUT_MS = 25_000;
const AUDIO_EVENT_BYTES = 32 * 1024;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_CACHE_LIMIT = 64;
const DISK_CACHE_DIR = path.join(process.cwd(), ".cache", "tts");

// ---------------------------------------------------------------------------
// Gemini client
// ---------------------------------------------------------------------------

// Keys from AI Studio may belong to the Developer API (generativelanguage) or
// to Vertex AI Express mode, and the "AQ." prefix alone does not tell which:
// the same prefix is issued for both. Unless GEMINI_API_MODE forces one, the
// Developer API is tried first and the working mode is remembered.
const clients = new Map<GeminiMode, GoogleGenAI>();
let workingMode: GeminiMode | null = null;

function geminiClient(mode: GeminiMode) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY is not configured."), { status: 503 });
  let client = clients.get(mode);
  if (!client) {
    client = new GoogleGenAI({ apiKey, vertexai: mode === "vertex", httpOptions: { timeout: 120_000 } });
    clients.set(mode, client);
  }
  return client;
}

function modeOrder(): GeminiMode[] {
  const forced = process.env.GEMINI_API_MODE;
  if (forced === "developer" || forced === "vertex") return [forced];
  return workingMode ? [workingMode] : ["developer", "vertex"];
}

function errorText(error: unknown) {
  return typeof (error as Error)?.message === "string" ? (error as Error).message : String(error);
}

/** Authentication failures that mean "this key belongs to the other API". */
function isWrongApi(error: unknown) {
  const status = (error as { status?: number })?.status;
  const text = errorText(error);
  if (/quota|RESOURCE_EXHAUSTED/i.test(text)) return false;
  return status === 401 || status === 403
    || /ACCESS_TOKEN_TYPE_UNSUPPORTED|API_KEY_INVALID|has not been used in project|UNAUTHENTICATED/i.test(text);
}

async function withGemini<T>(task: (ai: GoogleGenAI, mode: GeminiMode) => Promise<T>): Promise<T> {
  const order = modeOrder();
  let lastError: unknown;
  for (const [index, mode] of order.entries()) {
    try {
      const result = await task(geminiClient(mode), mode);
      workingMode = mode;
      return result;
    } catch (error) {
      lastError = error;
      if (!isWrongApi(error) || index === order.length - 1) throw error;
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Text and audio helpers
// ---------------------------------------------------------------------------

/**
 * Split on whitespace only, so the pieces' words concatenate back to exactly
 * the words of the full text and their timings line up with the display.
 */
export function splitNarration(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const pieces: string[] = [];
  let current: string[] = [];
  let length = 0;
  for (const word of words) {
    current.push(word);
    length += word.length + 1;
    const target = pieces.length === 0 ? FIRST_PIECE_CHARS : PIECE_CHARS;
    const endsSentence = /[.!?؟؛:…]["'”»)]*$/.test(word);
    if ((length >= target && endsSentence) || length >= target * 1.6) {
      pieces.push(current.join(" "));
      current = [];
      length = 0;
    }
  }
  if (current.length) pieces.push(current.join(" "));
  return pieces;
}

// TTS models take no system instruction, and any style direction in the prompt
// can be read aloud: a long paragraph once added ~14 s of speech to every
// piece, and even a one-line "Narrate warmly…:" lead-in was still spoken now
// and then. So the model gets only the text to read; the chosen voice carries
// the tone. Bump STYLE_VERSION whenever the prompt changes so cached audio made
// with the old one is not reused.
const STYLE_VERSION = "3";

/** Raw 16-bit mono PCM from an inline audio part (L16/PCM, or WAV). */
function pcmFromPart(data: string, mimeType: string) {
  const buffer = Buffer.from(data, "base64");
  const declaredRate = Number(mimeType.match(/rate=(\d+)/i)?.[1] ?? 24000);
  if (!/wav/i.test(mimeType) && buffer.subarray(0, 4).toString("latin1") !== "RIFF") {
    return { pcm: buffer, sampleRate: declaredRate };
  }
  let sampleRate = declaredRate;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.subarray(offset, offset + 4).toString("latin1");
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt " && size >= 8) sampleRate = buffer.readUInt32LE(body + 4);
    if (id === "data") return { pcm: buffer.subarray(body, Math.min(buffer.length, body + size)), sampleRate };
    offset = body + size + (size % 2);
  }
  return { pcm: Buffer.alloc(0), sampleRate };
}

function wavFromPcm(pcm: Buffer, sampleRate: number) {
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
  return Buffer.concat([header, pcm]);
}

/** Buffers PCM and sends it in even-length events so no sample is split. */
class AudioWriter {
  private pending = Buffer.alloc(0);
  constructor(private readonly send: (event: Record<string, unknown>) => void) {}

  write(pcm: Buffer, sampleRate: number, force = false) {
    this.pending = Buffer.concat([this.pending, pcm]);
    while (this.pending.length >= AUDIO_EVENT_BYTES || (force && this.pending.length >= 2)) {
      const size = Math.min(this.pending.length, AUDIO_EVENT_BYTES) & ~1;
      this.send({ type: "audio", data: this.pending.subarray(0, size).toString("base64"), sampleRate });
      this.pending = this.pending.subarray(size);
    }
    if (force) this.pending = Buffer.alloc(0);
  }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const memoryCache = new Map<string, { piece: CachedPiece; expiresAt: number }>();

function pieceKey(text: string, voice: string) {
  return createHash("sha256").update(`${TTS_MODEL}\u0000${STYLE_VERSION}\u0000${voice}\u0000${text}`).digest("hex");
}

function cachedPiece(key: string): CachedPiece | null {
  const entry = memoryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.piece;
  try {
    const file = path.join(DISK_CACHE_DIR, `${key}.json`);
    if (Date.now() - fs.statSync(file).mtimeMs > CACHE_TTL_MS) return null;
    const piece = JSON.parse(fs.readFileSync(file, "utf8")) as CachedPiece;
    if (!piece.pcmBase64 || !piece.sampleRate) return null;
    memoryCache.set(key, { piece, expiresAt: Date.now() + CACHE_TTL_MS });
    return piece;
  } catch {
    return null;
  }
}

function rememberPiece(key: string, piece: CachedPiece) {
  memoryCache.delete(key);
  memoryCache.set(key, { piece, expiresAt: Date.now() + CACHE_TTL_MS });
  while (memoryCache.size > MEMORY_CACHE_LIMIT) {
    const oldest = memoryCache.keys().next().value;
    if (oldest === undefined) break;
    memoryCache.delete(oldest);
  }
  // Survives a dev-server restart, so a replay does not spend another request.
  void fs.promises.mkdir(DISK_CACHE_DIR, { recursive: true })
    .then(() => fs.promises.writeFile(path.join(DISK_CACHE_DIR, `${key}.json`), JSON.stringify(piece), { mode: 0o600 }))
    .catch((error) => console.warn("Could not persist narration cache:", error));
}

// ---------------------------------------------------------------------------
// Synthesis and word timings
// ---------------------------------------------------------------------------

async function synthesise(text: string, voice: string, onAudio: (pcm: Buffer, sampleRate: number) => void) {
  return withGemini(async (ai, mode) => {
    const request = {
      model: TTS_MODEL,
      // Vertex rejects contents without a role; the Developer API defaults it.
      contents: [{ role: "user", parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    };
    const pieces: Buffer[] = [];
    let sampleRate = 24000;
    const take = (parts: Array<{ inlineData?: { data?: string; mimeType?: string } }> | undefined) => {
      for (const part of parts ?? []) {
        if (!part.inlineData?.data) continue;
        const audio = pcmFromPart(part.inlineData.data, part.inlineData.mimeType ?? "");
        sampleRate = audio.sampleRate;
        if (!audio.pcm.length) continue;
        pieces.push(audio.pcm);
        onAudio(audio.pcm, sampleRate);
      }
    };
    if (mode === "developer") {
      for await (const chunk of await ai.models.generateContentStream(request)) {
        take(chunk.candidates?.[0]?.content?.parts);
      }
    } else {
      // Vertex AI Express keys reject the streaming method, so each piece is
      // fetched whole; short pieces keep the first-sound delay small.
      take((await ai.models.generateContent(request)).candidates?.[0]?.content?.parts);
    }
    if (!pieces.length) throw new Error("The voice model returned no audio.");
    return { pcm: Buffer.concat(pieces), sampleRate };
  });
}

function normalisedWord(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[\p{P}\p{S}\p{M}]/gu, "");
}

/**
 * Match recognised words back to the displayed tokens. TTS normally recites
 * them one-for-one; the look-ahead handles punctuation and formatted numbers
 * without shifting every later highlight.
 */
function alignRecognisedWords(text: string, recognised: WordTimestamp[]) {
  const expected = text.split(/\s+/).filter(Boolean);
  if (expected.length === 0 || recognised.length === 0) return [];
  if (expected.length === recognised.length) {
    return expected.map((word, index) => ({ ...recognised[index], word }));
  }

  const aligned: Array<WordTimestamp | undefined> = new Array(expected.length);
  let expectedIndex = 0;
  let recognisedIndex = 0;
  while (expectedIndex < expected.length && recognisedIndex < recognised.length) {
    const expectedWord = normalisedWord(expected[expectedIndex]);
    const spokenWord = normalisedWord(recognised[recognisedIndex].word);
    if (expectedWord && expectedWord === spokenWord) {
      aligned[expectedIndex] = { ...recognised[recognisedIndex], word: expected[expectedIndex] };
      expectedIndex += 1;
      recognisedIndex += 1;
      continue;
    }
    const laterSpoken = recognised.slice(recognisedIndex + 1, recognisedIndex + 7)
      .findIndex((item) => normalisedWord(item.word) === expectedWord);
    const laterExpected = expected.slice(expectedIndex + 1, expectedIndex + 7)
      .findIndex((item) => normalisedWord(item) === spokenWord);
    if (laterSpoken >= 0 && (laterExpected < 0 || laterSpoken <= laterExpected)) {
      recognisedIndex += laterSpoken + 1;
    } else if (laterExpected >= 0) {
      expectedIndex += laterExpected + 1;
    } else {
      aligned[expectedIndex] = { ...recognised[recognisedIndex], word: expected[expectedIndex] };
      expectedIndex += 1;
      recognisedIndex += 1;
    }
  }

  // Unrecognised tokens share the gap between neighbouring exact matches.
  let cursor = 0;
  while (cursor < aligned.length) {
    if (aligned[cursor]) {
      cursor += 1;
      continue;
    }
    const gapStart = cursor;
    while (cursor < aligned.length && !aligned[cursor]) cursor += 1;
    const start = gapStart > 0 ? aligned[gapStart - 1]!.end : 0;
    const end = cursor < aligned.length ? aligned[cursor]!.start : recognised.at(-1)!.end;
    const step = Math.max(0, end - start) / (cursor - gapStart);
    for (let index = gapStart; index < cursor; index += 1) {
      aligned[index] = { word: expected[index], start: start + step * (index - gapStart), end: start + step * (index - gapStart + 1) };
    }
  }
  return aligned as WordTimestamp[];
}

/** Even spread by word length; used when no transcription is available. */
function estimateTimings(text: string, duration: number): WordTimestamp[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length || duration <= 0) return [];
  const weights = words.map((word) =>
    Math.max(1, word.replace(/[\p{P}\p{S}]/gu, "").length) + (/[.!?؟،,;:]$/.test(word) ? 3 : 0));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const lead = Math.min(0.25, duration * 0.03);
  const span = Math.max(0.01, duration - lead * 2);
  let cursor = lead;
  return words.map((word, index) => {
    const length = (span * weights[index]) / total;
    const timing = { word, start: cursor, end: cursor + length * 0.92 };
    cursor += length;
    return timing;
  });
}

async function transcribeTimings(text: string, pcm: Buffer, sampleRate: number): Promise<WordTimestamp[] | null> {
  // File upload exists only on the Developer API.
  if ((workingMode ?? modeOrder()[0]) !== "developer") return null;
  const ai = geminiClient("developer");
  const uploaded = await ai.files.upload({
    file: new Blob([wavFromPcm(pcm, sampleRate)], { type: "audio/wav" }),
    config: { mimeType: "audio/wav", displayName: "hikaya-narration.wav" },
  });
  try {
    if (!uploaded.uri) return null;
    // The installed SDK's types lag the transcription endpoint; keep this cast
    // narrow until transcription_config is included upstream.
    const interaction = await ai.interactions.create({
      model: TRANSCRIBE_MODEL,
      input: [{ type: "audio", uri: uploaded.uri, mime_type: "audio/wav" }],
      generation_config: { transcription_config: { mode: { type: "verbatim", timestamp_granularities: ["word"] } } },
    } as Parameters<typeof ai.interactions.create>[0]) as unknown as {
      steps?: Array<{ content?: Array<{ annotations?: Array<{ type?: string; text?: string; start_offset?: string; end_offset?: string }> }> }>;
    };
    const seconds = (value?: string) => (value ? Number.parseFloat(value.replace(/s$/i, "")) : Number.NaN);
    const recognised = (interaction.steps ?? [])
      .flatMap((step) => (step.content ?? []).flatMap((content) => content.annotations ?? []))
      .filter((annotation) => annotation.type === "word_info")
      .map((annotation) => ({ word: annotation.text ?? "", start: seconds(annotation.start_offset), end: seconds(annotation.end_offset) }))
      .filter((item) => item.word && Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);
    const aligned = alignRecognisedWords(text, recognised);
    return aligned.length ? aligned : null;
  } finally {
    if (uploaded.name) void ai.files.delete({ name: uploaded.name }).catch(() => undefined);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); console.warn("Narration word timing unavailable:", errorText(error)); resolve(null); },
    );
  });
}

function errorDetails(error: unknown) {
  const message = errorText(error);
  const quotaExceeded = (error as { status?: number })?.status === 429 || /quota|resource_exhausted|429/i.test(message);
  const dailyQuotaExceeded = quotaExceeded && /PerDay|per day|requests per day/i.test(message);
  const retryMatch = message.match(/retry in\s+([\d.]+)s/i) ?? message.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
  return {
    quotaExceeded,
    dailyQuotaExceeded,
    retryAfterSeconds: retryMatch ? Math.ceil(Number(retryMatch[1])) : 60,
    code: dailyQuotaExceeded ? "daily_quota_exceeded" : quotaExceeded ? "quota_exceeded" : "tts_unavailable",
    message: dailyQuotaExceeded
      ? "The daily natural-voice quota for this Gemini key is exhausted."
      : quotaExceeded
      ? "The natural-voice rate limit is temporarily exhausted."
      : "The natural-voice service is temporarily unavailable.",
  };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export function registerNarration(app: express.Express) {
  /**
   * Streams newline-delimited JSON events: `ready`, then `audio` (base64
   * 16-bit mono PCM) as it is generated, `timestamps` (the full list so far,
   * in reading order) whenever more words are timed, and finally `done` or
   * `error`.
   */
  app.post("/api/tts-stream", async (req, res) => {
    const { text, voiceName } = req.body ?? {};
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text is required." });
    if (text.length > MAX_NARRATION_CHARS) return res.status(413).json({ error: "Narration text is too long." });

    const voice = voiceName === "Charon" ? "Charon" : "Kore";
    const pieces = splitNarration(text);
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let connected = true;
    // The request stream closes once its body is read; only the response
    // closing means the listener actually left.
    res.on("close", () => { connected = false; });
    const send = (event: Record<string, unknown>) => {
      if (connected && !res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
    };

    const writer = new AudioWriter(send);
    const timings: Array<WordTimestamp[] | null> = pieces.map(() => null);
    const offsets: number[] = [];
    const pendingTimings: Promise<void>[] = [];
    let published = 0;
    let audioSeconds = 0;
    const publishTimings = () => {
      let ready = published;
      while (ready < pieces.length && timings[ready]) ready += 1;
      if (ready === published) return;
      published = ready;
      send({
        type: "timestamps",
        timestamps: timings.slice(0, ready).flatMap((list, index) =>
          list!.map((item) => ({ word: item.word, start: item.start + offsets[index], end: item.end + offsets[index] }))),
      });
    };

    try {
      send({ type: "ready", pieces: pieces.length });
      for (const [index, pieceText] of pieces.entries()) {
        if (!connected) break;
        offsets[index] = audioSeconds;
        const key = pieceKey(pieceText, voice);
        let piece = cachedPiece(key);
        let pcm: Buffer;
        if (piece) {
          pcm = Buffer.from(piece.pcmBase64, "base64");
          writer.write(pcm, piece.sampleRate, true);
        } else {
          const result = await synthesise(pieceText, voice, (chunk, rate) => writer.write(chunk, rate));
          pcm = result.pcm;
          writer.write(Buffer.alloc(0), result.sampleRate, true);
          piece = { pcmBase64: pcm.toString("base64"), sampleRate: result.sampleRate };
          rememberPiece(key, piece);
        }
        const duration = pcm.length / 2 / piece.sampleRate;
        audioSeconds += duration;

        if (piece.timestamps?.length) {
          timings[index] = piece.timestamps;
          publishTimings();
        } else {
          const stored = piece;
          pendingTimings.push(
            withTimeout(transcribeTimings(pieceText, pcm, stored.sampleRate), TIMING_TIMEOUT_MS).then((exact) => {
              if (exact) rememberPiece(key, { ...stored, timestamps: exact });
              timings[index] = exact ?? estimateTimings(pieceText, duration);
              publishTimings();
            }),
          );
        }
      }
      await Promise.all(pendingTimings);
      send({ type: "done" });
      return res.end();
    } catch (error) {
      console.error("Narration error:", errorText(error));
      send({ type: "error", ...errorDetails(error) });
      return res.end();
    }
  });
}
