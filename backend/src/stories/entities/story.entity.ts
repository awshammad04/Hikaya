/**
 * Placeholder shape for a Story, mirroring the `stories` table in
 * database/schema-draft.md. Will be replaced by a real ORM entity.
 */
export class Story {
  id: string;
  locationId: string;
  title: string;
  summary?: string;
  narrative: string;
  language?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
