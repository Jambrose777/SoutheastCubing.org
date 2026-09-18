-- Non-SE-hosted Nats/NAC/Worlds competitions detected via
-- competition_patterns_for_discord_pings. Tracked separately from the main
-- competitions table since these are Discord-only announcements that must
-- never appear on the public competitions page - unlike competitions, SECI
-- doesn't organize these and has no other use for their data. An SE-hosted
-- major championship match skips this table entirely and instead flows
-- through the normal competitions table.
CREATE TABLE IF NOT EXISTS major_championship_announcements (
  id TEXT PRIMARY KEY,
  name TEXT,
  city TEXT,
  start_date TEXT,
  end_date TEXT,
  full_date TEXT,
  competitor_limit INTEGER,
  registration_open TEXT,
  -- Set once posted to Discord and never cleared, so it isn't re-announced
  announced_on_discord_at TIMESTAMPTZ
);
