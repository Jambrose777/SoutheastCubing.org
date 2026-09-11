-- A major championship's WCA event ids, one row per event.
CREATE TABLE IF NOT EXISTS major_championship_events (
  major_championship_id TEXT NOT NULL REFERENCES major_championship_announcements (id),
  event_id TEXT NOT NULL,
  PRIMARY KEY (major_championship_id, event_id)
);
