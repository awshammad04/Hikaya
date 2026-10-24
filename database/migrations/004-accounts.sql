-- Visitor accounts: sessions, synced progress, personal photos and saved stories.
-- Additive only: no drops, deletes or changes to heritage content.
-- Apply once after schema.sql and 002-governorates.sql; it is safe to repeat.
BEGIN;

-- Emails are stored lower-cased by the API; this keeps the uniqueness rule
-- honest even if a row is ever written by hand.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Opaque session tokens. Only the SHA-256 of the token is stored, so a leaked
-- table cannot be replayed as cookies.
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash  TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);

-- One row per thing a visitor has done: opened a place, finished its quiz,
-- listened to its narration, or uncovered a community memory.
CREATE TABLE IF NOT EXISTS user_progress (
  user_id     TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind        TEXT        NOT NULL
                          CHECK (kind IN ('visited', 'quiz', 'audio', 'memory_uncovered')),
  item_id     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, kind, item_id)
);

-- Personal journey photos. Private to their owner; never part of the public
-- archive unless submitted separately as a contribution.
CREATE TABLE IF NOT EXISTS user_photos (
  id               TEXT        PRIMARY KEY,
  user_id          TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  governorate_id   TEXT,
  governorate_ids  TEXT[]      NOT NULL DEFAULT '{}',
  location_tag     TEXT        NOT NULL,
  note             TEXT        NOT NULL,
  photo            BYTEA       NOT NULL,
  photo_mime       TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_photos_user_idx ON user_photos (user_id, created_at DESC);

-- Stories a visitor chose to keep: generated journeys and location stories.
CREATE TABLE IF NOT EXISTS user_stories (
  id               TEXT        PRIMARY KEY,
  user_id          TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind             TEXT        NOT NULL CHECK (kind IN ('journey', 'location_story')),
  title            TEXT        NOT NULL,
  location_id      TEXT,
  governorate_ids  TEXT[]      NOT NULL DEFAULT '{}',
  payload          JSONB       NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_stories_user_idx ON user_stories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS contributions_user_idx ON contributions (user_id);

COMMIT;
