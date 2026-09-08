-- GENERATED FILE - do not edit by hand.
-- Reflects the live schema on the dev DSQL cluster (queried via
-- information_schema), not merely the migration files that produced it - see
-- db/migrations/ for that history. Regenerate with
-- `pnpm --filter backend schema-snapshot` after applying a new migration.

CREATE TABLE competition_events (
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  event_id TEXT NOT NULL,
  PRIMARY KEY (competition_id, event_id)
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
  is_in_staff_application BOOLEAN NOT NULL DEFAULT false,
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
