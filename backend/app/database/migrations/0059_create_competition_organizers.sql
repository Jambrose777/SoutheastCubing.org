-- Organizers assigned to a competition, keyed by people_id.
CREATE TABLE IF NOT EXISTS competition_organizers (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  people_id TEXT NOT NULL REFERENCES people (id)
);
