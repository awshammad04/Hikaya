export interface SavedVoiceStory {
  referenceCode: string;
  status: 'pending_review' | 'approved' | 'rejected';
  language: string;
  transcript: string;
  message: string;
}

/**
 * Same-origin bridge: frontend/server.ts forwards this path to the Nest API and
 * adds the internal token server-side, so the browser never calls the backend
 * directly and no VITE_ variable is needed.
 */
const ENDPOINT = '/api/v1/voice/transcribe';

export async function uploadVoiceStory(params: {
  audio: Blob;
  locationId?: string;
  language?: 'ar' | 'en';
}): Promise<SavedVoiceStory> {
  const extension = extensionForMime(params.audio.type || 'audio/webm');

  const form = new FormData();
  form.append('audio', params.audio, `hikaya-story.${extension}`);
  form.append('language', params.language || 'ar');
  form.append('consent', 'true');
  if (params.locationId) form.append('locationId', params.locationId);

  const response = await fetch(ENDPOINT, { method: 'POST', body: form });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // Nest's ValidationPipe returns `message` as an array.
    const message = Array.isArray(payload?.message)
      ? payload.message.join(' ')
      : payload?.message;
    throw new Error(message || 'Could not transcribe the recording');
  }
  return payload as SavedVoiceStory;
}

function extensionForMime(mimeType: string) {
  const type = mimeType.toLowerCase();
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('wav')) return 'wav';
  if (type.includes('ogg')) return 'ogg';
  return 'webm';
}
