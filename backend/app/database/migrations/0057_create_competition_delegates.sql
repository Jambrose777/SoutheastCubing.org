-- Delegates assigned to a competition, keyed by people_id (not delegates.id) so a
-- non-SE Delegate upserted into people can be linked the same way as one of our own.
CREATE TABLE IF NOT EXISTS competition_delegates (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  people_id TEXT NOT NULL REFERENCES people (id),
  is_lead BOOLEAN NOT NULL DEFAULT false
);
