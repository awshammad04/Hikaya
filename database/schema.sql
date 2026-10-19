-- =============================================================================
-- Hikaya - PostgreSQL schema
-- =============================================================================
-- Sprint 2 implementation of database/schema-draft.md.
--
-- Requires PostgreSQL 13 or newer (uses the built-in gen_random_uuid()).
--
-- Usage:
--   createdb hikaya
--   psql -d hikaya -f database/schema.sql
--   psql -d hikaya -f database/seed.sql
--
-- The script is idempotent: it drops and recreates the MVP tables, so running
-- it again resets the schema. Do not run it against a database that holds real
-- user contributions.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Clean slate (child tables first because of the foreign keys)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS timeline_events CASCADE;
DROP TABLE IF EXISTS contributions CASCADE;
DROP TABLE IF EXISTS media CASCADE;
DROP TABLE IF EXISTS stories CASCADE;
DROP TABLE IF EXISTS location_categories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- -----------------------------------------------------------------------------
-- Shared trigger function: keep updated_at honest
-- -----------------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
-- Platform accounts. In the MVP only editors/admins actually sign in; visitors
-- may submit a contribution without an account, in which case
-- contributions.user_id stays NULL and the free-text contributor fields are used.
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  full_name     TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT,
  role          TEXT        NOT NULL DEFAULT 'visitor'
                            CHECK (role IN ('visitor', 'contributor', 'editor', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- locations
-- -----------------------------------------------------------------------------
-- The primary key is a human-readable Jerusalem place slug (for example
-- 'muslim-quarter', 'sheikh-jarrah' or 'bab-al-amud'). The same slug is used by:
--   * the API path            GET /api/v1/locations/jerusalem
--   * the AI-ready content     content/ai-ready/*.md  (location_id in frontmatter)
--   * the frontend route       /locations/jerusalem
-- Keeping one identifier across all three layers is what makes the integration
-- flow work without a translation table.
-- -----------------------------------------------------------------------------
CREATE TABLE locations (
  id              TEXT         PRIMARY KEY,
  name            TEXT         NOT NULL,
  arabic_name     TEXT,
  city            TEXT,
  country         TEXT         NOT NULL DEFAULT 'Palestine',
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  description     TEXT,
  cover_image_url TEXT,
  -- Where the reviewed material for this location lives in the repository.
  content_file    TEXT,        -- e.g. content/ai-ready/muslim-quarter-summary.md
  ai_summary_file TEXT,        -- same reviewed summary consumed by the AI service
  is_published    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT locations_latitude_range  CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  CONSTRAINT locations_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE INDEX locations_city_idx      ON locations (city);
CREATE INDEX locations_published_idx ON locations (is_published);

CREATE TRIGGER locations_set_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- categories  (content categories)
-- -----------------------------------------------------------------------------
CREATE TABLE categories (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- location_categories  (many-to-many between locations and categories)
-- -----------------------------------------------------------------------------
CREATE TABLE location_categories (
  location_id TEXT NOT NULL REFERENCES locations (id)  ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
  PRIMARY KEY (location_id, category_id)
);

CREATE INDEX location_categories_category_idx ON location_categories (category_id);

-- -----------------------------------------------------------------------------
-- stories
-- -----------------------------------------------------------------------------
-- Holds both editor-written narratives and AI-generated ones.
--   original_content   the reviewed source text the story was built from
--   simplified_story   the narrative shown to the user
--   uncertainty_notes  gaps the AI flagged instead of inventing facts
-- Only rows with status = 'published' are served to the public API.
-- -----------------------------------------------------------------------------
CREATE TABLE stories (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  location_id       TEXT        NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  author_id         TEXT        REFERENCES users (id) ON DELETE SET NULL,
  title             TEXT        NOT NULL,
  summary           TEXT,
  original_content  TEXT,
  simplified_story  TEXT        NOT NULL,
  audience          TEXT        NOT NULL DEFAULT 'general'
                                CHECK (audience IN ('child', 'student', 'tourist', 'general', 'short')),
  language          TEXT        NOT NULL DEFAULT 'en',
  tone              TEXT        NOT NULL DEFAULT 'storytelling'
                                CHECK (tone IN ('neutral', 'educational', 'emotional', 'storytelling')),
  source            TEXT,
  is_ai_generated   BOOLEAN     NOT NULL DEFAULT FALSE,
  uncertainty_notes TEXT[]      NOT NULL DEFAULT '{}',
  status            TEXT        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'pending_review', 'published', 'rejected')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stories_location_idx        ON stories (location_id);
CREATE INDEX stories_status_idx          ON stories (status);
CREATE INDEX stories_location_status_idx ON stories (location_id, status);

CREATE TRIGGER stories_set_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- media  (media metadata - the files themselves are never stored in this repo)
-- -----------------------------------------------------------------------------
-- Every row must carry `license` and `credit`. The gallery displays both next to
-- the image, so an asset without them cannot be shown honestly and must not be
-- added. Rows are generated from content/media/media.json - see
-- ai/scripts/export_seed_data.py.
--
-- `era` splits historical photography from present-day photography, and
-- `pair_role` marks the two halves of a before/after comparison: exactly one
-- 'before' and one 'after' per location, of the same subject.
-- -----------------------------------------------------------------------------
CREATE TABLE media (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  location_id TEXT        NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('image', 'audio', 'video', 'document')),
  url         TEXT        NOT NULL,
  thumb_url   TEXT,
  width       INTEGER     CHECK (width > 0),
  height      INTEGER     CHECK (height > 0),
  subject     TEXT,       -- the landmark shown, e.g. 'Damascus Gate'
  subject_ar  TEXT,       -- visitor-facing Arabic landmark name
  description TEXT,
  description_ar TEXT,    -- visitor-facing Arabic educational caption
  era         TEXT        NOT NULL DEFAULT 'modern'
                          CHECK (era IN ('modern', 'historical')),
  pair_role   TEXT        CHECK (pair_role IN ('cover', 'before', 'after')),
  credit      TEXT,       -- photographer or holding institution
  license     TEXT,       -- recorded for every asset, see content/README.md
  license_url TEXT,
  captured_at TEXT,       -- free text: sources give ranges like 'between 1934 and 1939'
  source_url  TEXT,       -- page the asset was taken from
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX media_location_idx ON media (location_id);
CREATE INDEX media_type_idx     ON media (type);
CREATE INDEX media_pair_idx     ON media (location_id, pair_role);

-- -----------------------------------------------------------------------------
-- timeline_events
-- -----------------------------------------------------------------------------
-- The historical timeline shown on a location page. Rows are generated from the
-- reviewed summaries in content/ai-ready/ by ai/scripts/export_seed_data.py, so
-- the content files stay the single source of truth for what the timeline says.
--
-- `is_tradition` marks an entry that comes from religious or oral tradition
-- rather than documented history. The UI labels those differently - the same
-- fact/tradition separation the content files and the AI module enforce.
-- -----------------------------------------------------------------------------
CREATE TABLE timeline_events (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  location_id  TEXT        NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  period_label TEXT        NOT NULL,   -- e.g. '586 BCE', 'Umayyad era (661-750 CE)'
  description  TEXT        NOT NULL,
  -- Approximate year for ordering only; negative is BCE. Never displayed.
  sort_year    INTEGER     NOT NULL,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  is_tradition BOOLEAN     NOT NULL DEFAULT FALSE,
  source_file  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX timeline_location_idx ON timeline_events (location_id, sort_order);

-- -----------------------------------------------------------------------------
-- quiz_questions
-- -----------------------------------------------------------------------------
-- Short comprehension questions shown after a story. Every question must carry
-- `source_note` naming where the answer comes from in the reviewed content, so a
-- reader who disagrees can go and check.
-- -----------------------------------------------------------------------------
CREATE TABLE quiz_questions (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  location_id   TEXT        NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  question      TEXT        NOT NULL,
  options       TEXT[]      NOT NULL,
  answer_index  INTEGER     NOT NULL CHECK (answer_index >= 0),
  explanation   TEXT        NOT NULL,
  source_note   TEXT        NOT NULL,
  sort_order    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT quiz_answer_in_range CHECK (answer_index < array_length(options, 1))
);

CREATE INDEX quiz_location_idx ON quiz_questions (location_id, sort_order);

-- -----------------------------------------------------------------------------
-- contributions
-- -----------------------------------------------------------------------------
-- User-submitted memories and stories. Everything lands as 'pending_review';
-- nothing a visitor submits is served publicly until an editor approves it.
-- user_id is NULL for anonymous submissions from the public contribution form.
-- -----------------------------------------------------------------------------
CREATE TABLE contributions (
  id                TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- Short human-readable code given to the contributor so they can check the
  -- review status later without an account, e.g. 'HK-7Q4M2X'.
  reference_code    TEXT        UNIQUE,
  location_id       TEXT        NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  user_id           TEXT        REFERENCES users (id) ON DELETE SET NULL,
  category_id       TEXT        REFERENCES categories (id) ON DELETE SET NULL,
  title             TEXT        NOT NULL,
  content           TEXT        NOT NULL,
  contributor_name  TEXT,
  contributor_email TEXT,
  media_url         TEXT,
  media_type        TEXT        CHECK (media_type IN ('image', 'audio', 'video')),
  status            TEXT        NOT NULL DEFAULT 'pending_review'
                                CHECK (status IN ('pending_review', 'approved', 'rejected')),
  review_notes      TEXT,
  reviewed_at       TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contributions_location_idx  ON contributions (location_id);
CREATE INDEX contributions_status_idx    ON contributions (status);
CREATE INDEX contributions_reference_idx ON contributions (reference_code);

COMMIT;
