-- Competition id patterns (using * as a "match anything" wildcard) that
-- override how a competition is announced on Discord.
CREATE TABLE IF NOT EXISTS competition_patterns_for_discord_pings (
  id_pattern TEXT PRIMARY KEY,
  -- Whether this pattern's competitions can be hosted outside the
  -- country_iso2=US-filtered main WCA fetch (e.g. NAC/Worlds can be held
  -- outside the US), and so need a supplemental direct-by-id lookup to be
  -- detected at all when not SE-hosted.
  try_direct_lookup BOOLEAN NOT NULL DEFAULT false
);
