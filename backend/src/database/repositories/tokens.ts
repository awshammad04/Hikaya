/**
 * Injection tokens for the repository layer.
 *
 * Services depend on these tokens, not on a concrete implementation, so the
 * same service code runs against PostgreSQL or against the in-memory seed.
 */
export const LOCATIONS_REPOSITORY = 'LOCATIONS_REPOSITORY';
export const STORIES_REPOSITORY = 'STORIES_REPOSITORY';
export const CONTRIBUTIONS_REPOSITORY = 'CONTRIBUTIONS_REPOSITORY';
export const MEDIA_REPOSITORY = 'MEDIA_REPOSITORY';
export const TIMELINE_REPOSITORY = 'TIMELINE_REPOSITORY';
export const QUIZ_REPOSITORY = 'QUIZ_REPOSITORY';
