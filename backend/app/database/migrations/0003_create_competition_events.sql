-- A competition's WCA event ids, one row per event, so a single event can be
-- queried/indexed on its own.
CREATE TABLE IF NOT EXISTS competition_events (
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  event_id TEXT NOT NULL,
  PRIMARY KEY (competition_id, event_id)
);
