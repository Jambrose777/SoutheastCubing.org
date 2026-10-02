-- Persists a Delegate's incrementally-granted manage_competitions OAuth
-- token so it can be reused across requests/logins.
CREATE TABLE IF NOT EXISTS wca_oauth_grants (
  id TEXT PRIMARY KEY,
  people_id TEXT NOT NULL UNIQUE REFERENCES people (id),
  scopes TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
