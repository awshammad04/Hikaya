import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type {
  Progress,
  SavedStory,
  User,
  UserPhoto,
} from '../database/entities/account.entity';
import type { Contribution } from '../database/entities/contribution.entity';
import type { AccountsRepository } from '../database/repositories/accounts.repository';
import type { ContributionsRepository } from '../database/repositories/contributions.repository';
import {
  ACCOUNTS_REPOSITORY,
  CONTRIBUTIONS_REPOSITORY,
} from '../database/repositories/tokens';
import {
  AddPhotoDto,
  AddStoryDto,
  PROGRESS_FIELDS,
  ProgressDto,
  RemoveProgressDto,
} from './dto/account.dto';
import { CurrentUser } from './session';
import { SessionGuard } from './session.guard';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_STORY_CHARS = 600_000;
const PHOTO_DATA_URL =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

export interface ProgressView {
  visited: string[];
  quiz: string[];
  audio: string[];
  memoryUncovered: string[];
}

export type PhotoView = Omit<UserPhoto, 'userId'> & { photoUrl: string };
export type StoryView = Omit<SavedStory, 'userId'>;

function progressView(progress: Progress): ProgressView {
  return {
    visited: progress.visited,
    quiz: progress.quiz,
    audio: progress.audio,
    memoryUncovered: progress.memory_uncovered,
  };
}

function photoView(photo: UserPhoto): PhotoView {
  const view: Partial<UserPhoto> & PhotoView = {
    ...photo,
    photoUrl: `/api/v1/me/photos/${photo.id}/image`,
  };
  delete view.userId;
  return view;
}

function storyView(story: SavedStory): StoryView {
  const view: Partial<SavedStory> & StoryView = { ...story };
  delete view.userId;
  return view;
}

/** Only accept bytes that really are the image type the data URL claims. */
function decodePhoto(dataUrl: string): { photo: Buffer; photoMime: string } {
  const match = PHOTO_DATA_URL.exec(dataUrl);
  if (!match)
    throw new BadRequestException('photoDataUrl must be a JPEG, PNG or WebP.');
  const photo = Buffer.from(match[2], 'base64');
  if (photo.length > MAX_PHOTO_BYTES)
    throw new BadRequestException('The photo is larger than 5 MB.');
  const signatures: Record<string, (bytes: Buffer) => boolean> = {
    'image/jpeg': (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8,
    'image/png': (bytes) => bytes.subarray(0, 4).toString('hex') === '89504e47',
    'image/webp': (bytes) =>
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP',
  };
  if (!signatures[match[1]](photo))
    throw new BadRequestException('The photo data does not match its type.');
  return { photo, photoMime: match[1] };
}

/**
 * The signed-in visitor's own data. Everything here is private to its owner.
 *
 * GET    /api/v1/me/progress               -> places, quizzes, narrations, memories
 * POST   /api/v1/me/progress               -> merge ids in (used for guest -> account sync)
 * POST   /api/v1/me/progress/remove        -> forget ids of one kind
 * GET    /api/v1/me/photos                 -> journey photos (metadata + image URL)
 * POST   /api/v1/me/photos                 -> add a photo (idempotent on id)
 * GET    /api/v1/me/photos/:id/image       -> the image bytes
 * DELETE /api/v1/me/photos/:id
 * GET    /api/v1/me/stories                -> saved journeys and location stories
 * POST   /api/v1/me/stories                -> save one (idempotent on id)
 * DELETE /api/v1/me/stories/:id
 * GET    /api/v1/me/contributions          -> submissions made while signed in, any status
 */
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(
    @Inject(ACCOUNTS_REPOSITORY)
    private readonly accounts: AccountsRepository,
    @Inject(CONTRIBUTIONS_REPOSITORY)
    private readonly contributions: ContributionsRepository,
  ) {}

  @Get('progress')
  async progress(@CurrentUser() user: User): Promise<ProgressView> {
    return progressView(await this.accounts.getProgress(user.id));
  }

  @Post('progress')
  @HttpCode(200)
  async addProgress(
    @CurrentUser() user: User,
    @Body() dto: ProgressDto,
  ): Promise<ProgressView> {
    return progressView(
      await this.accounts.addProgress(user.id, {
        visited: dto.visited,
        quiz: dto.quiz,
        audio: dto.audio,
        memory_uncovered: dto.memoryUncovered,
      }),
    );
  }

  @Post('progress/remove')
  @HttpCode(200)
  async removeProgress(
    @CurrentUser() user: User,
    @Body() dto: RemoveProgressDto,
  ): Promise<ProgressView> {
    return progressView(
      await this.accounts.removeProgress(
        user.id,
        PROGRESS_FIELDS[dto.kind],
        dto.ids,
      ),
    );
  }

  @Get('photos')
  async photos(@CurrentUser() user: User): Promise<PhotoView[]> {
    return (await this.accounts.listPhotos(user.id)).map(photoView);
  }

  @Post('photos')
  @HttpCode(201)
  async addPhoto(
    @CurrentUser() user: User,
    @Body() dto: AddPhotoDto,
  ): Promise<PhotoView> {
    const image = decodePhoto(dto.photoDataUrl);
    try {
      return photoView(
        await this.accounts.addPhoto({
          id: dto.id ?? randomUUID(),
          userId: user.id,
          governorateId: dto.governorateId ?? null,
          governorateIds: dto.governorateIds ?? [],
          locationTag: dto.locationTag.trim(),
          note: dto.note.trim(),
          ...image,
          createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
        }),
      );
    } catch {
      throw new BadRequestException('That photo id is already in use.');
    }
  }

  @Get('photos/:id/image')
  async photoImage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const image = await this.accounts.findPhotoImage(user.id, id);
    if (!image) throw new NotFoundException('Photo not found.');
    res.setHeader('Content-Type', image.photoMime);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(image.photo);
  }

  @Delete('photos/:id')
  @HttpCode(204)
  async deletePhoto(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<void> {
    if (!(await this.accounts.deletePhoto(user.id, id)))
      throw new NotFoundException('Photo not found.');
  }

  @Get('stories')
  async stories(@CurrentUser() user: User): Promise<StoryView[]> {
    return (await this.accounts.listStories(user.id)).map(storyView);
  }

  @Post('stories')
  @HttpCode(201)
  async addStory(
    @CurrentUser() user: User,
    @Body() dto: AddStoryDto,
  ): Promise<StoryView> {
    if (JSON.stringify(dto.payload).length > MAX_STORY_CHARS)
      throw new BadRequestException('The story is too large to save.');
    try {
      return storyView(
        await this.accounts.addStory({
          id: dto.id ?? randomUUID(),
          userId: user.id,
          kind: dto.kind,
          title: dto.title.trim(),
          locationId: dto.locationId ?? null,
          governorateIds: dto.governorateIds ?? [],
          payload: dto.payload,
          createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
        }),
      );
    } catch {
      throw new BadRequestException('That story id is already in use.');
    }
  }

  @Delete('stories/:id')
  @HttpCode(204)
  async deleteStory(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<void> {
    if (!(await this.accounts.deleteStory(user.id, id)))
      throw new NotFoundException('Story not found.');
  }

  @Get('contributions')
  contributionsMade(@CurrentUser() user: User): Promise<Contribution[]> {
    return this.contributions.findByUser(user.id);
  }
}
