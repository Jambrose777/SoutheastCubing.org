-- Plain membership on a team, dated so history is preserved when someone leaves. 
CREATE TABLE IF NOT EXISTS team_memberships (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams (id),
  people_id TEXT NOT NULL REFERENCES people (id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Nullable = still active.
  end_date DATE,
  -- Free text, no per-team catalog, no history - current value only. Never
  -- set for a Board membership row.
  special_role TEXT,
  -- Constrained to the fixed subset of frontend/src/styles/color-pallet.scss
  -- colors already used elsewhere in the app. Never set for a Board
  -- membership row.
  color TEXT CHECK (
    color IS NULL
    OR color IN ('black', 'blue', 'dark_grey', 'green', 'grey', 'yellow', 'purple', 'orange', 'red')
  ),
  -- Nullable - null means seeded by migration.
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
