-- One-off seed of the fixed teams: Admin (hidden, not itself editable
-- through the Manage Teams dashboard), Board, the six Officer roles (each
-- modeled as its own fixed hidden team), and Board Liaisons. Granting/
-- revoking Admin only ever happens via migration - never through the dashboard.
-- Fixed, human-readable ids (rather than generated UUIDs) so application code
-- can reference these rows by a stable constant instead of a lookup-by-name.
-- created_by/updated_by are left NULL (system-seeded).
INSERT INTO teams (id, name, description, email, hidden) VALUES
  ('admin', 'Admin', 'Software team members with full administrative access to the site.', NULL, true),
  (
    'board',
    'Southeast Cubing, Inc. Board',
    'These are the official board members of the Southeast Cubing, Inc. nonprofit organization.',
    'board@southeastcubing.org',
    false
  ),
  ('officer_president', 'President', NULL, NULL, true),
  ('officer_vice_president', 'Vice President', NULL, NULL, true),
  ('officer_secretary', 'Secretary', NULL, NULL, true),
  ('officer_assistant_secretary', 'Assistant Secretary', NULL, NULL, true),
  ('officer_treasurer', 'Treasurer', NULL, NULL, true),
  ('officer_assistant_treasurer', 'Assistant Treasurer', NULL, NULL, true),
  ('board_liaisons', 'Board Liaisons', NULL, NULL, false)
ON CONFLICT (id) DO NOTHING;
