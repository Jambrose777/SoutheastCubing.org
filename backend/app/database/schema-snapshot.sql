-- GENERATED FILE - do not edit by hand.
-- Reflects the live schema on the dev DSQL cluster (queried via
-- information_schema), not merely the migration files that produced it - see
-- app/database/migrations/ for that history. Regenerate with
-- `pnpm --filter backend schema-snapshot` after applying a new migration.

CREATE TABLE competition_events (
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  event_id TEXT NOT NULL,
  PRIMARY KEY (competition_id, event_id)
);

CREATE TABLE competition_patterns_for_discord_pings (
  id_pattern TEXT NOT NULL PRIMARY KEY,
  try_direct_lookup BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE competitions (
  id TEXT NOT NULL PRIMARY KEY,
  url TEXT,
  name TEXT,
  website TEXT,
  city TEXT,
  venue_address TEXT,
  venue_details TEXT,
  latitude_degrees DOUBLE PRECISION,
  longitude_degrees DOUBLE PRECISION,
  country_iso2 TEXT,
  competitor_limit INTEGER,
  start_date TEXT,
  registration_open TEXT,
  registration_close TEXT,
  end_date TEXT,
  venue TEXT,
  venue_url TEXT,
  state TEXT,
  is_in_volunteer_application BOOLEAN NOT NULL DEFAULT false,
  accepted_registrations INTEGER,
  full_date TEXT,
  is_manual_competition BOOLEAN NOT NULL DEFAULT false,
  announced_on_discord_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE competitions_meta (
  id INTEGER NOT NULL PRIMARY KEY,
  last_checked TIMESTAMP WITH TIME ZONE,
  CHECK (id = 1)
);

CREATE TABLE major_championship_announcements (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT,
  city TEXT,
  start_date TEXT,
  end_date TEXT,
  full_date TEXT,
  competitor_limit INTEGER,
  registration_open TEXT,
  announced_on_discord_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE major_championship_events (
  major_championship_id TEXT NOT NULL REFERENCES major_championship_announcements (id),
  event_id TEXT NOT NULL,
  PRIMARY KEY (major_championship_id, event_id)
);

CREATE TABLE people (
  id TEXT NOT NULL PRIMARY KEY,
  wca_id TEXT,
  wca_user_id TEXT,
  name TEXT NOT NULL,
  picture_url TEXT,
  picture_synced_with_wca BOOLEAN NOT NULL DEFAULT true,
  wca_picture_source_url TEXT,
  thumbnail_crop_x INTEGER,
  thumbnail_crop_y INTEGER,
  thumbnail_crop_w INTEGER,
  thumbnail_crop_h INTEGER,
  cubingusa_state TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  ip_address TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id TEXT NOT NULL PRIMARY KEY,
  people_id TEXT NOT NULL REFERENCES people (id),
  email TEXT,
  dob DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
