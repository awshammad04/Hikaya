/**
 * Placeholder shape for a Location, mirroring the `locations` table
 * defined in database/schema-draft.md.
 * This will be replaced by a real ORM entity (e.g. TypeORM/Prisma model)
 * once the database layer is implemented.
 */
export class Location {
  id: string;
  name: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  categoryId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
