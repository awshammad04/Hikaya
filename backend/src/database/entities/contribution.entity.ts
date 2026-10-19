/**
 * A user-submitted memory or story, mirroring the `contributions` table in
 * database/schema.sql.
 *
 * Everything a visitor submits arrives as `pending_review`. Nothing is served
 * publicly until an editor approves it.
 */
export type ContributionStatus = 'pending_review' | 'approved' | 'rejected';

export class Contribution {
  id: string;
  /**
   * Short human-readable code handed to the contributor, e.g. 'HK-7Q4M2X'.
   * It lets someone check the review status of their memory later without an
   * account, which is the only way to close the loop while contributions stay
   * anonymous.
   */
  referenceCode?: string;
  locationId: string;
  userId?: string | null;
  categoryId?: string | null;
  title: string;
  content: string;
  contributorName?: string;
  contributorEmail?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'video';
  status: ContributionStatus;
  reviewNotes?: string | null;
  reviewedAt?: Date | null;
  submittedAt: Date;
}
