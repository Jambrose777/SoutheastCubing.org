-- Equipment holders assigned to a competition, keyed by people_id - a null
-- people_id represents the plain "Other" option.
CREATE TABLE IF NOT EXISTS competition_equipment_holders (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions (id),
  people_id TEXT REFERENCES people (id)
);
