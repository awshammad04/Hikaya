/**
 * A heritage location, mirroring the `locations` table in
 * database/schema.sql.
 *
 * `id` is a readable Jerusalem slug ('muslim-quarter', 'bab-al-amud') shared with
 * the API path, the AI-ready content frontmatter and the frontend route.
 */
export class Location {
  id: string;
  governorateId?: string;
  arabicDescription?: string;
  reviewStatus?: string;
  coordinateStatus?: string;
  name: string;
  arabicName?: string;
  city?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  coverImageUrl?: string;
  /** Path to the reviewed content record, e.g. `content/ai-ready/muslim-quarter-summary.md`. */
  contentFile?: string;
  /** Path to the AI-ready summary the AI module reads. */
  aiSummaryFile?: string;
  categories: string[];
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
