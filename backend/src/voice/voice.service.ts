import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { StoryAudio } from '../database/entities/story-audio.entity';
import type { VoiceRepository } from '../database/repositories/voice.repository';
import { VOICE_REPOSITORY } from '../database/repositories/tokens';
import { LocationsService } from '../locations/locations.service';
import { TranscribeVoiceDto } from './transcribe-voice.dto';

export interface VoiceSubmission {
  referenceCode: string;
  status: StoryAudio['status'];
  language: string;
  transcript: string;
  message: string;
}

export interface VoiceStatusView {
  referenceCode: string;
  status: StoryAudio['status'];
  submittedAt: Date;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
}

const TRANSCRIPTION_PROMPT =
  'هذا تسجيل لقصة أو شهادة فلسطينية، وقد يتضمن لهجة فلسطينية وأسماء قرى ومدن وأشخاص. اكتب الكلام كما قيل دون اختلاق معلومات.';

/**
 * Stores a recorded testimony privately, transcribes it, and files it for
 * editorial review. The transcript is machine output, so it is never
 * published on its own: an editor approves the recording and the text together.
 */
@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    @Inject(VOICE_REPOSITORY) private readonly voice: VoiceRepository,
    private readonly locationsService: LocationsService,
    private readonly config: ConfigService,
  ) {}

  async submit(
    file: Express.Multer.File,
    dto: TranscribeVoiceDto,
  ): Promise<VoiceSubmission> {
    if (!file.buffer?.length) {
      throw new BadRequestException('Audio file is empty');
    }
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Voice transcription is not configured.',
      );
    }
    // A clear 404 instead of a foreign-key error from PostgreSQL.
    if (dto.locationId) await this.locationsService.findOne(dto.locationId);

    const language = dto.language ?? 'ar';
    // Transcribe first: a failed transcription must not leave an orphan file.
    const transcript = await this.transcribe(file, language, apiKey);

    const storageKey = `${randomUUID()}.${this.extensionForMime(file.mimetype)}`;
    const directory = this.uploadDirectory();
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, storageKey), file.buffer);

    try {
      const saved = await this.voice.create({
        referenceCode: this.generateReferenceCode(),
        locationId: dto.locationId ?? null,
        audioPath: storageKey,
        originalFilename: file.originalname || storageKey,
        mimeType: (file.mimetype || 'audio/webm').split(';')[0],
        transcript,
        language,
        consentGivenAt: new Date(),
        status: 'pending_review',
      });
      this.logger.log(`Voice ${saved.referenceCode} submitted - awaiting review`);
      return {
        referenceCode: saved.referenceCode,
        status: saved.status,
        language: saved.language,
        transcript: saved.transcript,
        message:
          'Thank you - your recording was received and is waiting for review before anything is published. Keep the reference code to check on it later.',
      };
    } catch (error) {
      await unlink(join(directory, storageKey)).catch(() => undefined);
      throw error;
    }
  }

  async findStatus(code: string): Promise<VoiceStatusView> {
    const item = await this.voice.findByReference(code.trim().toUpperCase());
    if (!item) throw new NotFoundException('No recording with that code');
    return {
      referenceCode: item.referenceCode,
      status: item.status,
      submittedAt: item.submittedAt,
      reviewedAt: item.reviewedAt,
      reviewNotes: item.reviewNotes,
    };
  }

  private async transcribe(
    file: Express.Multer.File,
    language: string,
    apiKey: string,
  ): Promise<string> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'audio/webm',
      }),
      file.originalname || 'recording.webm',
    );
    form.append(
      'model',
      this.config.get<string>('OPENAI_TRANSCRIBE_MODEL') ||
        'gpt-4o-mini-transcribe',
    );
    form.append('language', language);
    if (language === 'ar') form.append('prompt', TRANSCRIPTION_PROMPT);

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
    } catch (error) {
      this.logger.error(
        `Transcription request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('Transcription service is unreachable');
    }

    const payload = (await response.json().catch(() => ({}))) as {
      text?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      // Log the provider message; do not echo it to the browser.
      this.logger.error(
        `Transcription failed (${response.status}): ${payload.error?.message ?? 'no message'}`,
      );
      throw new BadGatewayException('Transcription service failed');
    }
    const text = payload.text?.trim();
    if (!text) throw new BadGatewayException('No transcript was returned');
    return text;
  }

  private uploadDirectory(): string {
    return (
      this.config.get<string>('VOICE_UPLOAD_DIR') ||
      join(process.cwd(), 'uploads', 'voice')
    );
  }

  private generateReferenceCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(6);
    let code = '';
    for (const byte of bytes) code += alphabet[byte % alphabet.length];
    return `HV-${code}`;
  }

  private extensionForMime(mimeType: string): string {
    const type = (mimeType || '').toLowerCase();
    if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
    if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
    if (type.includes('wav')) return 'wav';
    if (type.includes('ogg')) return 'ogg';
    if (type.includes('flac')) return 'flac';
    if (type.includes('aac')) return 'aac';
    return 'webm';
  }
}
