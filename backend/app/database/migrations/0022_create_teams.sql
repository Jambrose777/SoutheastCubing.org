-- SECI Teams and the Board (Board itself stored the same way, plus Admin,
-- the six Officer roles, and Board Liaisons).
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  -- Fixed/uneditable through the dashboard for Board, Admin, Board Liaisons,
  -- and the six officer rows; freely editable for ordinary teams.
  name TEXT NOT NULL,
  description TEXT,
  email TEXT,
  -- Always true for Admin and the six officer rows.
  hidden BOOLEAN NOT NULL DEFAULT false,
  -- Nullable = active. Never set for Board, Admin, Board Liaisons, or the six
  -- officer rows - those can never be archived.
  archived_at TIMESTAMPTZ,
  -- Nullable - null means seeded by migration.
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
