-- Leadership as its own dated stint, layered on top of (but tracked
-- independently from) the underlying team_memberships row, so a person's
-- leadership tenure can differ from and be reconstructed independently of
-- their broader membership tenure. At most one active (end_date IS NULL)
-- row per team at a time; zero is allowed. Never used for Board/Officer/
-- Board Liaisons rows - only ordinary teams have a Leader concept.
CREATE TABLE IF NOT EXISTS team_leaders (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams (id),
  people_id TEXT NOT NULL REFERENCES people (id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Nullable = still the active leader.
  end_date DATE,
  -- Nullable - null means seeded by migration.
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
