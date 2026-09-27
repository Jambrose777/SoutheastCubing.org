-- Delegate roster, Whether a signed-in person currently counts as a Delegate/Regional
-- Delegate, and at what rank, is resolved at request time by joining
-- delegate_rank_history.
CREATE TABLE IF NOT EXISTS delegates (
  id TEXT PRIMARY KEY,
  people_id TEXT NOT NULL UNIQUE REFERENCES people (id),
  -- Delegate-authored, editable by that Delegate.
  bio TEXT,
  -- Refreshed directly from the `total_delegated` field in the nightly sync payload.
  competitions_delegated_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
