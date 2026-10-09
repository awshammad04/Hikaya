-- Upgrade an existing Hikaya database. No drops, deletes or replacement of heritage content.
-- Apply once before seed-palestine.sql; it is safe to repeat.
BEGIN;
CREATE TABLE IF NOT EXISTS governorates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  arabic_name TEXT NOT NULL,
  description TEXT,
  arabic_description TEXT,
  map_config JSONB NOT NULL DEFAULT '{}',
  cover_image_url TEXT
);
INSERT INTO governorates (id,slug,name,arabic_name) VALUES
 ('jerusalem','jerusalem','Jerusalem','القدس'),
 ('ramallah','ramallah','Ramallah','رام الله'),
 ('hebron','hebron','Hebron','الخليل'),
 ('gaza','gaza','Gaza','غزة') ON CONFLICT DO NOTHING;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS governorate_id TEXT NOT NULL DEFAULT 'jerusalem' REFERENCES governorates(id);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS arabic_description TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'legacy_reviewed';
-- Only pre-existing rows inherit legacy review. New records require an explicit review state.
ALTER TABLE locations ALTER COLUMN review_status SET DEFAULT 'pending_review';
ALTER TABLE locations ADD COLUMN IF NOT EXISTS coordinate_status TEXT;
CREATE INDEX IF NOT EXISTS locations_governorate_published_idx ON locations(governorate_id,is_published);
-- Map metadata is configuration, not replacement of existing heritage or user data.
UPDATE governorates SET map_config = '{"mapCenter":{"latitude":31.7815,"longitude":35.235},"mapZoom":14,"bounds":{"minLat":31.765,"maxLat":31.798,"minLng":35.215,"maxLng":35.255}}' WHERE id='jerusalem' AND map_config='{}';
UPDATE governorates SET map_config = '{"mapCenter":{"latitude":31.93,"longitude":35.2},"mapZoom":11,"bounds":{"minLat":31.88,"maxLat":31.98,"minLng":35.15,"maxLng":35.25}}' WHERE id='ramallah' AND map_config='{}';
UPDATE governorates SET map_config = '{"mapCenter":{"latitude":31.5244,"longitude":35.1083},"mapZoom":14,"bounds":{"minLat":31.518,"maxLat":31.535,"minLng":35.099,"maxLng":35.118}}' WHERE id='hebron' AND map_config='{}';
UPDATE governorates SET map_config = '{"mapCenter":{"latitude":31.504,"longitude":34.464},"mapZoom":14,"bounds":{"minLat":31.498,"maxLat":31.511,"minLng":34.457,"maxLng":34.471}}' WHERE id='gaza' AND map_config='{}';
COMMIT;
