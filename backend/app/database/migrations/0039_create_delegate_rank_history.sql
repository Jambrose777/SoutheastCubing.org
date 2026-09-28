-- Tracks every Trainee/Junior/Delegate/Senior/Regional/Temporary rank stint
-- - repeatable in both directions (rank can drop via demotion as well as
-- rise via promotion, and Regional/Senior can be entered and left more than
-- once, non-contiguously), and someone who's fully removed and later
-- returns starts a brand-new row, possibly at a lower rank than they left
-- at. A person can have more than one concurrently-open row at once (e.g. a
-- `delegate` row and a separate `regional` row, both open at the same time).
-- A person with no open row at all here is not currently an active Delegate 
-- in any capacity.
CREATE TABLE IF NOT EXISTS delegate_rank_history (
  id TEXT PRIMARY KEY,
  delegate_id TEXT NOT NULL REFERENCES delegates (id),
  rank TEXT NOT NULL CHECK (
    rank IN ('trainee', 'junior', 'delegate', 'senior', 'regional', 'temporary')
  ),
  start_date DATE NOT NULL,
  -- Nullable - null means this rank is currently active.
  end_date DATE,
  -- Nullable - null means seeded by migration or written by the nightly
  -- sync (a system actor, not a signed-in user).
  created_by TEXT REFERENCES users (id),
  updated_by TEXT REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
