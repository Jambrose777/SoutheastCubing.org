-- Competitions from the WCA API plus manually-entered Contentful competitions
-- (see is_manual_competition), merged into one table since the backend and
-- frontend serve/display them identically.
CREATE TABLE IF NOT EXISTS competitions (
  -- Fields directly imported from WCA
  id TEXT PRIMARY KEY,
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

  -- Stored as the raw strings the WCA API returns rather than DATE/TIMESTAMPTZ
  -- columns, since they're already zero-padded ISO strings that sort
  -- correctly as text and this avoids any timezone-conversion surprises when
  -- re-serializing them back to the frontend.
  start_date TEXT,
  registration_open TEXT,
  registration_close TEXT,
  end_date TEXT,

  -- Fields computed/derived by the backend rather than imported as-is (see
  -- formatCompetitionData() in competitions.js).
  -- Parsed out of WCA's venue field, which embeds a markdown-style link.
  venue TEXT,
  venue_url TEXT,
  -- Parsed from the trailing ", <State>" in city, not a separate WCA field.
  state TEXT,
  -- Looked up against the Google Forms staff-application list
  is_in_staff_application BOOLEAN NOT NULL DEFAULT false,
  -- Fetched from a separate WCA /registrations endpoint call
  accepted_registrations INTEGER,
  -- Formatted from start_date/end_date.
  full_date TEXT,
  -- True only for Contentful-sourced entries, not anything WCA reports.
  is_manual_competition BOOLEAN NOT NULL DEFAULT false,
  -- Set once posted to Discord and never cleared, so it isn't re-announced
  announced_on_discord_at TIMESTAMPTZ
);
