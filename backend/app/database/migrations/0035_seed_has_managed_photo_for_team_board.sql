-- One-time promotion of everyone already on record as a Team/Board member
-- (current or past) as of this migration to true, and everyone else to
-- false - matches what promoteToManagedPhoto() would have set for each
-- promoted person had they been added after this story shipped.
-- COALESCE(has_managed_photo, false) OR ... rather than a bare EXISTS(...)
-- so this can never regress an already-true row back to false.
UPDATE people
SET has_managed_photo = COALESCE(has_managed_photo, false) OR EXISTS (
  SELECT 1 FROM team_memberships WHERE team_memberships.people_id = people.id
);
