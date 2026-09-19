-- Server-side backing store for the httpOnly session cookie. `id` is a hash
-- of the opaque session token (never the raw token itself), so a session can
-- be revoked instantly by deleting its row instead of relying on a
-- self-contained credential to expire on its own.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  -- Captured once at creation purely for after-the-fact abuse tracing - never
  -- re-validated while the session is in active use.
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
