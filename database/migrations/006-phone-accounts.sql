-- Sign up and log in with a phone number, the common identifier in Palestine.
-- Additive only: existing email accounts keep working unchanged.
-- Apply once after 005-story-review.sql; it is safe to repeat.
BEGIN;

-- Stored in E.164 (e.g. +970599123456) so "059 912 3456" with +970 and a
-- pasted "+970 59 912 3456" are the same account.
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users (phone);

-- New accounts are created with a phone number only.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_identity_check;
ALTER TABLE users ADD CONSTRAINT users_identity_check
  CHECK (email IS NOT NULL OR phone IS NOT NULL);

COMMIT;
