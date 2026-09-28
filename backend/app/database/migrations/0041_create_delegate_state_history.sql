-- Tracks every Southeast state a Delegate has lived in over time, replacing
-- a flat "current state" column so repeated moves in/out of the Southeast
-- region (or between two Southeast states) are preserved. Only SE states
-- are ever stored here - a non-SE state is never recorded; moving out of
-- the Southeast just closes the current row (end_date) with no new row
-- opened, regardless of where the person actually moved to. State is
-- always stored as its full name (e.g. "Georgia"), never an abbreviation -
-- matches exactly what the nightly WCA sync writes (it strips WCA's own
-- "USA (...)" wrapper down to the bare state name).
CREATE TABLE IF NOT EXISTS delegate_state_history (
  id TEXT PRIMARY KEY,
  delegate_id TEXT NOT NULL REFERENCES delegates (id),
  state TEXT NOT NULL,
  start_date DATE NOT NULL,
  -- Nullable - null for the current/most recent row.
  end_date DATE,
  -- Nullable - null means seeded by migration or written by the nightly
  -- sync (a system actor, not a signed-in user).
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
