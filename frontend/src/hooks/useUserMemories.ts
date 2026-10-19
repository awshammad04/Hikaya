import { useCallback, useEffect, useState } from "react";
import type { UserJourneyMemory } from "../types";

const STORAGE_KEY = "hikaya-quds.user-journey-memories";
const MEMORIES_EVENT = "hikaya-quds:user-memories";
const MAX_IMAGE_EDGE = 1280;

function isMemory(value: unknown): value is UserJourneyMemory {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string"
    && typeof item.photoDataUrl === "string"
    && item.photoDataUrl.startsWith("data:image/")
    && typeof item.locationTag === "string"
    && typeof item.note === "string"
    && typeof item.createdAt === "string";
}

export function readUserMemories(): UserJourneyMemory[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isMemory) : [];
  } catch {
    return [];
  }
}

function storeUserMemories(memories: UserJourneyMemory[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memories));
  window.dispatchEvent(new CustomEvent(MEMORIES_EVENT));
}

function imageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_decode_failed"));
    };
    image.src = url;
  });
}

/** Downsizes camera photos before putting them in localStorage. */
export async function prepareMemoryPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("not_an_image");
  const image = await imageFromFile(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("image_processing_failed");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

export function useUserMemories() {
  const [memories, setMemories] = useState<UserJourneyMemory[]>(readUserMemories);

  useEffect(() => {
    const update = () => setMemories(readUserMemories());
    window.addEventListener(MEMORIES_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(MEMORIES_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const addMemory = useCallback((memory: Omit<UserJourneyMemory, "id" | "createdAt">) => {
    const next: UserJourneyMemory = {
      ...memory,
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
    };
    storeUserMemories([next, ...readUserMemories()]);
    return next;
  }, []);

  return { memories, addMemory };
}
