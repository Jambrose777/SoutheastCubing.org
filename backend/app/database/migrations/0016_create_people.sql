-- Shared public identity/display record for anyone the site needs to show a
-- name/picture for (an authenticated user, a Delegate, a Team/Board member,
-- or a synced competition Organizer) - referenced by those tables instead of
-- each keeping its own copy. Upserted by wca_id when present, falling back
-- to wca_user_id, so the same person is never duplicated regardless of
-- which of those sources creates the row first.
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  wca_id TEXT UNIQUE,
  wca_user_id TEXT UNIQUE,
  name TEXT NOT NULL,
  picture_url TEXT,
  -- False once a manual picture upload overrides the WCA-sourced one; every
  -- upsert into this row must skip overwriting `picture_url` (and
  -- wca_picture_source_url) while this is false.
  picture_synced_with_wca BOOLEAN NOT NULL DEFAULT true,
  wca_picture_source_url TEXT,
  thumbnail_crop_x INTEGER,
  thumbnail_crop_y INTEGER,
  thumbnail_crop_w INTEGER,
  thumbnail_crop_h INTEGER,
  cubingusa_state TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
