// Dev-only role-impersonation runtime config, as returned by
// GET /auth/dev-impersonation-config - `enabled` is always false outside
// local dev, since the backend itself is the real security boundary.
export interface DevImpersonationConfig {
  enabled: boolean;
  presets: string[];
}
