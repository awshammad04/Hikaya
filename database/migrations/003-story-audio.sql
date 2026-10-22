-- Voice contributions: a recorded testimony plus its machine transcript.
-- Same rule as contributions: nothing is public until an editor approves it.
-- Safe to repeat. Apply after schema.sql / 002-governorates.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS story_audio (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reference_code    TEXT        NOT NULL UNIQUE,
  location_id       TEXT        REFERENCES locations (id) ON DELETE SET NULL,
  -- Private storage key (relative path), never a public URL.
  audio_path        TEXT        NOT NULL,
  original_filename TEXT        NOT NULL,
  mime_type         TEXT        NOT NULL,
  transcript        TEXT        NOT NULL,
  language          TEXT        NOT NULL DEFAULT 'ar',
  consent_given_at  TIMESTAMPTZ NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending_review'
                                CHECK (status IN ('pending_review', 'approved', 'rejected')),
  review_notes      TEXT,
  reviewed_at       TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS story_audio_location_idx ON story_audio (location_id);
CREATE INDEX IF NOT EXISTS story_audio_status_idx   ON story_audio (status);
COMMIT;
