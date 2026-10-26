import { randomUUID } from 'crypto';
import {
  Contribution,
  ContributionStatus,
} from '../entities/contribution.entity';
import { DatabaseService } from '../database.service';
import { SEED_CONTRIBUTIONS } from '../seed/seed-data';
import { countBy } from './count-by';

export type NewContribution = Omit<
  Contribution,
  'id' | 'submittedAt' | 'reviewedAt' | 'reviewNotes' | 'reviewedBy'
>;

export interface ReviewDecision {
  status: Exclude<ContributionStatus, 'pending_review'>;
  reviewNotes: string | null;
  reviewedBy: string;
}

export interface ContributionsRepository {
  create(contribution: NewContribution): Promise<Contribution>;
  /** Approved contributions only - pending submissions are never public. */
  findApprovedByLocation(locationId: string): Promise<Contribution[]>;
  findApproved(): Promise<Contribution[]>;
  /**
   * Lookup by the code given to the contributor at submission time. This is the
   * one read path that returns a contribution regardless of status, because it
   * is the contributor asking about their own submission.
   */
  findByReference(referenceCode: string): Promise<Contribution | null>;
  /** Every submission linked to an account, any status - for its owner only. */
  findByUser(userId: string): Promise<Contribution[]>;
  /** Approved count per location id, for the summary on location cards. */
  countsApprovedByLocation(): Promise<Record<string, number>>;

  /**
   * Reviewer queue, any status. Pending submissions come oldest first so the
   * queue is worked in order; decided ones come most recently reviewed first.
   */
  findByStatus(status: ContributionStatus): Promise<Contribution[]>;
  countsByStatus(): Promise<Record<ContributionStatus, number>>;
  /** Records a reviewer's decision; null when the id does not exist. */
  review(id: string, decision: ReviewDecision): Promise<Contribution | null>;
}

const EMPTY_STATUS_COUNTS = (): Record<ContributionStatus, number> => ({
  pending_review: 0,
  approved: 0,
  rejected: 0,
});

interface ContributionRow {
  id: string;
  reference_code: string | null;
  location_id: string;
  user_id: string | null;
  category_id: string | null;
  title: string;
  content: string;
  contributor_name: string | null;
  contributor_email: string | null;
  media_url: string | null;
  media_type: 'image' | 'audio' | 'video' | null;
  status: ContributionStatus;
  review_notes: string | null;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  submitted_at: Date;
}

function toContribution(row: ContributionRow): Contribution {
  return {
    id: row.id,
    referenceCode: row.reference_code ?? undefined,
    locationId: row.location_id,
    userId: row.user_id,
    categoryId: row.category_id,
    title: row.title,
    content: row.content,
    contributorName: row.contributor_name ?? undefined,
    contributorEmail: row.contributor_email ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    mediaType: row.media_type ?? undefined,
    status: row.status,
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by ?? null,
    submittedAt: row.submitted_at,
  };
}

export class PostgresContributionsRepository implements ContributionsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(contribution: NewContribution): Promise<Contribution> {
    const result = await this.db.query<ContributionRow>(
      `INSERT INTO contributions
         (reference_code, location_id, user_id, category_id, title, content,
          contributor_name, contributor_email, media_url, media_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        contribution.referenceCode ?? null,
        contribution.locationId,
        contribution.userId ?? null,
        contribution.categoryId ?? null,
        contribution.title,
        contribution.content,
        contribution.contributorName ?? null,
        contribution.contributorEmail ?? null,
        contribution.mediaUrl ?? null,
        contribution.mediaType ?? null,
        contribution.status,
      ],
    );
    return toContribution(result.rows[0]);
  }

  async findApprovedByLocation(locationId: string): Promise<Contribution[]> {
    const result = await this.db.query<ContributionRow>(
      `SELECT * FROM contributions
       WHERE location_id = $1 AND status = 'approved'
       ORDER BY submitted_at DESC`,
      [locationId],
    );
    return result.rows.map(toContribution);
  }

  async findApproved(): Promise<Contribution[]> {
    const result = await this.db.query<ContributionRow>(
      `SELECT * FROM contributions
       WHERE status = 'approved'
       ORDER BY submitted_at DESC`,
    );
    return result.rows.map(toContribution);
  }

  async findByReference(referenceCode: string): Promise<Contribution | null> {
    const result = await this.db.query<ContributionRow>(
      'SELECT * FROM contributions WHERE reference_code = $1',
      [referenceCode],
    );
    return result.rows.length ? toContribution(result.rows[0]) : null;
  }

  async findByUser(userId: string): Promise<Contribution[]> {
    const result = await this.db.query<ContributionRow>(
      `SELECT * FROM contributions WHERE user_id = $1
       ORDER BY submitted_at DESC`,
      [userId],
    );
    return result.rows.map(toContribution);
  }

  async countsApprovedByLocation(): Promise<Record<string, number>> {
    const result = await this.db.query<{ location_id: string; count: string }>(
      `SELECT location_id, COUNT(*)::text AS count FROM contributions
       WHERE status = 'approved' GROUP BY location_id`,
    );
    return Object.fromEntries(
      result.rows.map((row) => [row.location_id, Number(row.count)]),
    );
  }

  async findByStatus(status: ContributionStatus): Promise<Contribution[]> {
    const order =
      status === 'pending_review'
        ? 'submitted_at ASC'
        : 'reviewed_at DESC NULLS LAST, submitted_at DESC';
    const result = await this.db.query<ContributionRow>(
      `SELECT * FROM contributions WHERE status = $1 ORDER BY ${order}`,
      [status],
    );
    return result.rows.map(toContribution);
  }

  async countsByStatus(): Promise<Record<ContributionStatus, number>> {
    const result = await this.db.query<{
      status: ContributionStatus;
      count: string;
    }>(
      'SELECT status, COUNT(*)::text AS count FROM contributions GROUP BY status',
    );
    const counts = EMPTY_STATUS_COUNTS();
    for (const row of result.rows) counts[row.status] = Number(row.count);
    return counts;
  }

  async review(
    id: string,
    decision: ReviewDecision,
  ): Promise<Contribution | null> {
    const result = await this.db.query<ContributionRow>(
      `UPDATE contributions
       SET status = $2, review_notes = $3, reviewed_by = $4, reviewed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, decision.status, decision.reviewNotes, decision.reviewedBy],
    );
    return result.rows.length ? toContribution(result.rows[0]) : null;
  }
}

/**
 * Serves database/seed.sql from memory when PostgreSQL is not configured.
 *
 * Submissions accumulate for the lifetime of the process only. That is fine for
 * the MVP demo, and the warning in DatabaseService makes it clear which mode is
 * running.
 */
export class InMemoryContributionsRepository implements ContributionsRepository {
  private readonly contributions: Contribution[] = SEED_CONTRIBUTIONS.map(
    (item) => ({
      ...item,
    }),
  );

  create(contribution: NewContribution): Promise<Contribution> {
    const created: Contribution = {
      ...contribution,
      id: randomUUID(),
      reviewNotes: null,
      reviewedAt: null,
      reviewedBy: null,
      submittedAt: new Date(),
    };
    this.contributions.unshift(created);
    return Promise.resolve(created);
  }

  findApprovedByLocation(locationId: string): Promise<Contribution[]> {
    return Promise.resolve(
      this.contributions.filter(
        (item) => item.locationId === locationId && item.status === 'approved',
      ),
    );
  }

  findApproved(): Promise<Contribution[]> {
    return Promise.resolve(
      this.contributions.filter((item) => item.status === 'approved'),
    );
  }

  findByReference(referenceCode: string): Promise<Contribution | null> {
    return Promise.resolve(
      this.contributions.find((item) => item.referenceCode === referenceCode) ??
        null,
    );
  }

  findByUser(userId: string): Promise<Contribution[]> {
    return Promise.resolve(
      this.contributions.filter((item) => item.userId === userId),
    );
  }

  countsApprovedByLocation(): Promise<Record<string, number>> {
    return Promise.resolve(
      countBy(
        this.contributions.filter((item) => item.status === 'approved'),
        (item) => item.locationId,
      ),
    );
  }

  findByStatus(status: ContributionStatus): Promise<Contribution[]> {
    const time = (date?: Date | null) => date?.getTime() ?? 0;
    // Stored newest first; reversed so same-millisecond ties keep their order.
    const items = this.contributions
      .filter((item) => item.status === status)
      .reverse();
    items.sort((a, b) =>
      status === 'pending_review'
        ? time(a.submittedAt) - time(b.submittedAt)
        : time(b.reviewedAt) - time(a.reviewedAt) ||
          time(b.submittedAt) - time(a.submittedAt),
    );
    return Promise.resolve(items);
  }

  countsByStatus(): Promise<Record<ContributionStatus, number>> {
    const counts = EMPTY_STATUS_COUNTS();
    for (const item of this.contributions) counts[item.status] += 1;
    return Promise.resolve(counts);
  }

  review(id: string, decision: ReviewDecision): Promise<Contribution | null> {
    const item = this.contributions.find((entry) => entry.id === id);
    if (!item) return Promise.resolve(null);
    Object.assign(item, decision, { reviewedAt: new Date() });
    return Promise.resolve({ ...item });
  }
}
