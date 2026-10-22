import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TranscribeVoiceDto } from './transcribe-voice.dto';
import { VoiceService, VoiceStatusView, VoiceSubmission } from './voice.service';

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
  'audio/x-m4a',
  'audio/m4a',
];

/**
 * Voice contribution endpoints.
 *
 * POST /api/v1/voice/transcribe        -> store a recording, return its transcript
 * GET  /api/v1/voice/status/:code      -> review status by reference code
 *
 * Recordings are private until an editor approves them; no endpoint here
 * serves the audio file itself.
 */
@Controller('voice')
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('transcribe')
  @HttpCode(201)
  @UseInterceptors(
    // No `storage` option: Nest keeps the upload in memory by default.
    FileInterceptor('audio', {
      limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
      fileFilter: (_request, file, callback) => {
        const type = (file.mimetype || '').split(';')[0].toLowerCase();
        if (!ALLOWED_AUDIO_TYPES.includes(type)) {
          return callback(
            new BadRequestException(`Unsupported audio type: ${file.mimetype}`),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  transcribe(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: TranscribeVoiceDto,
  ): Promise<VoiceSubmission> {
    if (!file) throw new BadRequestException('Please attach an audio file');
    return this.voiceService.submit(file, dto);
  }

  @Get('status/:code')
  findStatus(@Param('code') code: string): Promise<VoiceStatusView> {
    return this.voiceService.findStatus(code);
  }
}
