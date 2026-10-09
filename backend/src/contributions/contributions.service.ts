import { randomInt } from 'crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { Contribution } from '../database/entities/contribution.entity';
import type { ContributionsRepository } from '../database/repositories/contributions.repository';
import { CONTRIBUTIONS_REPOSITORY } from '../database/repositories/tokens';
import { LocationsService } from '../locations/locations.service';

/** Unambiguous when read aloud or written down: no O/0, I/1, or U. */
const CODE_ALPHABET = '23456789ACDEFGHJKLMNPQRSTVWXYZ';
const CODE_LENGTH = 6;
const CODE_ATTEMPTS = 5;

/** What a contributor sees when they look up their submission. */
export interface ContributionStatusView {
  referenceCode: string;
  locationId: string;
  title: string;
  status: Contribution['status'];
  submittedAt: Date;
  reviewedAt?: Date | null;
  /** Plain-language explanation of what the status means and what happens next. */
  message: string;
  /** Reviewer feedback, only once a decision has been made. */
  reviewNotes?: string | null;
}

const STATUS_MESSAGES: Record<Contribution['status'], string> = {
  pending_review:
    'Your memory is waiting for an editor to read it. Nothing is published until it has been reviewed.',
  approved:
    'Your memory has been approved and is published on its location page as oral heritage.',
  rejected:
    'An editor decided not to publish this memory. The reviewer note below explains why.',
};

/**
 * ContributionsService
 *
 * Accepts user-submitted memories. Every submission is stored as
 * `pending_review` - nothing a visitor sends becomes publicly readable until an
 * editor approves it.
 *
 * Each submission also gets a short reference code. Contributions are anonymous
 * by design, so without one there would be no way for a contributor to ever
 * find out what happened to their memory.
 */
@Injectable()
export class ContributionsService {
  private readonly logger = new Logger(ContributionsService.name);

  constructor(
    @Inject(CONTRIBUTIONS_REPOSITORY)
    private readonly contributions: ContributionsRepository,
    private readonly locationsService: LocationsService,
  ) {}

  /**
   * @throws NotFoundException when the location does not exist, so the form
   * gets a clear 404 rather than a foreign-key error from PostgreSQL.
   */
  async create(dto: CreateContributionDto): Promise<Contribution> {
    await this.locationsService.findOne(dto.locationId);

    const contribution = await this.contributions.create({
      referenceCode: await this.generateReferenceCode(),
      locationId: dto.locationId,
      userId: null,
      categoryId: dto.categoryId ?? null,
      title: dto.title,
      content: dto.content,
      contributorName: dto.contributorName,
      contributorEmail: dto.contributorEmail,
      mediaUrl: dto.mediaUrl,
      mediaType: dto.mediaType,
      status: 'pending_review',
    });

    this.logger.log(
      `Contribution ${contribution.referenceCode} submitted for ${dto.locationId} - awaiting review`,
    );
    return contribution;
  }

  async findApprovedByLocation(locationId: string): Promise<Contribution[]> {
    return this.publicContributions(
      await this.contributions.findApprovedByLocation(locationId),
    );
  }

  async findApproved(): Promise<Contribution[]> {
    return this.publicContributions(await this.contributions.findApproved());
  }

  private publicContributions(items: Contribution[]): Contribution[] {
    if (process.env.NODE_ENV !== 'production') return items;
    return items.map((item) => {
      const publicItem = { ...item };
      delete publicItem.contributorEmail;
      delete publicItem.referenceCode;
      delete publicItem.reviewNotes;
      return publicItem;
    });
  }

  /**
   * Look up a submission by its reference code.
   *
   * Returns only the status and the contributor's own text - never another
   * contributor's details - because a reference code is a weak secret that
   * could be guessed.
   */
  async findStatus(referenceCode: string): Promise<ContributionStatusView> {
    const code = referenceCode.trim().toUpperCase();
    const contribution = await this.contributions.findByReference(code);
    if (!contribution) {
      throw new NotFoundException(
        `No contribution found with reference "${code}". Check the code from your submission receipt.`,
      );
    }
    return {
      referenceCode: contribution.referenceCode as string,
      locationId: contribution.locationId,
      title: contribution.title,
      status: contribution.status,
      submittedAt: contribution.submittedAt,
      reviewedAt: contribution.reviewedAt,
      message: STATUS_MESSAGES[contribution.status],
      reviewNotes:
        contribution.status === 'pending_review'
          ? null
          : contribution.reviewNotes,
    };
  }

  /**
   * Build a code like `HK-7Q4M2X`, retrying on the rare collision.
   *
   * `randomInt` rather than `Math.random` because the code is the only handle a
   * contributor has on their submission, and predictable codes would let anyone
   * enumerate them.
   */
  private async generateReferenceCode(): Promise<string> {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      let body = '';
      for (let index = 0; index < CODE_LENGTH; index += 1) {
        body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      }
      const code = `HK-${body}`;
      if (!(await this.contributions.findByReference(code))) {
        return code;
      }
    }
    // 30^6 codes make this effectively unreachable; failing loudly beats
    // returning a duplicate that would break the lookup for both contributors.
    throw new Error('Could not allocate a unique contribution reference code');
  }
}
