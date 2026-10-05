CREATE TABLE IF NOT EXISTS competition_banner_dismissals (
  id TEXT PRIMARY KEY,
  people_id TEXT NOT NULL REFERENCES people (id),
  wca_competition_id TEXT NOT NULL,
  UNIQUE (people_id, wca_competition_id)
);