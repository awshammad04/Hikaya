-- Personal stories and the review queue behind them.
-- Additive only: no drops of data, no changes to heritage content.
-- Apply once after 004-accounts.sql; it is safe to repeat.
BEGIN;

-- Who approved or rejected a public submission. Reviewers are accounts with
-- the 'editor' or 'admin' role (or listed in HIKAYA_ADMIN_EMAILS).
ALTER TABLE contributions
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users (id) ON DELETE SET NULL;

-- A story the visitor wrote themselves. It stays private in their passport
-- unless they choose to share it, which files a copy as a contribution.
ALTER TABLE user_stories DROP CONSTRAINT IF EXISTS user_stories_kind_check;
ALTER TABLE user_stories ADD CONSTRAINT user_stories_kind_check
  CHECK (kind IN ('journey', 'location_story', 'my_story'));

COMMIT;
