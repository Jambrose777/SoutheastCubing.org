-- GENERATED FILE - do not edit by hand.
-- Reflects the live schema on the dev DSQL cluster (queried via
-- information_schema), not merely the migration files that produced it - see
-- app/database/migrations/ for that history. Regenerate with
-- `pnpm --filter southeastcubing-org-api schema-snapshot` after applying a new migration.

CREATE TABLE competition_banner_dismissals (
  id TEXT NOT NULL PRIMARY KEY,
  people_id TEXT NOT NULL REFERENCES people (id),
  wca_competition_id TEXT NOT NULL
);

CREATE TABLE competition_delegates (
  id TEXT NOT NULL PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  people_id TEXT NOT NULL REFERENCES people (id),
  is_lead BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE competition_equipment_holders (
  id TEXT NOT NULL PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  people_id TEXT REFERENCES people (id)
);

CREATE TABLE competition_events (
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  event_id TEXT NOT NULL,
  PRIMARY KEY (competition_id, event_id)
);

CREATE TABLE competition_organizers (
  id TEXT NOT NULL PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  people_id TEXT NOT NULL REFERENCES people (id)
);

CREATE TABLE competition_patterns_for_discord_pings (
  id_pattern TEXT NOT NULL PRIMARY KEY,
  try_direct_lookup BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE competition_unofficial_events (
  id TEXT NOT NULL PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  event_name TEXT NOT NULL,
  icon TEXT NOT NULL
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
  announced_on_discord_at TIMESTAMP WITH TIME ZONE,
  wca_competition_id TEXT,
  is_announced BOOLEAN DEFAULT false,
  waiting_list_count INTEGER,
  waiting_list_count_updated_at TIMESTAMP WITH TIME ZONE,
  wca_drive_link TEXT,
  wca_drive_folder_type TEXT,
  is_multiple_cities_competition BOOLEAN DEFAULT false,
  is_major BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false
);

CREATE TABLE competitions_meta (
  id INTEGER NOT NULL PRIMARY KEY,
  last_bulk_refresh_at TIMESTAMP WITH TIME ZONE,
  bulk_refresh_started_at TIMESTAMP WITH TIME ZONE,
  CHECK (id = 1)
);

CREATE TABLE delegate_rank_history (
  id TEXT NOT NULL PRIMARY KEY,
  delegate_id TEXT NOT NULL REFERENCES people (id),
  rank TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (rank = ANY (ARRAY['trainee'::text, 'junior'::text, 'delegate'::text, 'senior'::text, 'regional'::text, 'temporary'::text])
);

CREATE TABLE delegate_state_history (
  id TEXT NOT NULL PRIMARY KEY,
  delegate_id TEXT NOT NULL REFERENCES people (id),
  state TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE delegates (
  id TEXT NOT NULL PRIMARY KEY,
  people_id TEXT NOT NULL REFERENCES people (id),
  bio TEXT,
  competitions_delegated_count INTEGER,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
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
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  has_managed_photo BOOLEAN DEFAULT false
);

CREATE TABLE sessions (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  ip_address TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE team_leaders (
  id TEXT NOT NULL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams (id),
  people_id TEXT NOT NULL REFERENCES people (id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE team_memberships (
  id TEXT NOT NULL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams (id),
  people_id TEXT NOT NULL REFERENCES people (id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  special_role TEXT,
  color TEXT,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CHECK (color IS NULL) OR (color = ANY (ARRAY['black'::text, 'blue'::text, 'dark_grey'::text, 'green'::text, 'grey'::text, 'yellow'::text, 'purple'::text, 'orange'::text, 'red'::text])
);

CREATE TABLE teams (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  email TEXT,
  hidden BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id TEXT NOT NULL PRIMARY KEY,
  people_id TEXT NOT NULL REFERENCES people (id),
  email TEXT,
  dob DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE wca_oauth_grants (
  id TEXT NOT NULL PRIMARY KEY,
  people_id TEXT NOT NULL REFERENCES people (id),
  scopes TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
