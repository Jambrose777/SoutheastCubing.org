-- Auth-only account record, created only via a completed WCA OAuth login.
-- Deliberately disjoint from `people` - no name/picture columns here.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  -- Unique since a `people` row is claimed by at most one `users` row.
  people_id TEXT NOT NULL UNIQUE REFERENCES people (id),
  -- Only populated if the `email` OAuth scope was granted.
  email TEXT,
  -- Only populated once the `dob` OAuth scope is separately granted.
  dob DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
