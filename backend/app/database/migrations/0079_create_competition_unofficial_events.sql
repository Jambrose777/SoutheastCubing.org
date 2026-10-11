-- Unofficial competition events are planner-managed and may reuse the same icon.
CREATE TABLE IF NOT EXISTS competition_unofficial_events (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  event_name TEXT NOT NULL,
  icon TEXT NOT NULL
);