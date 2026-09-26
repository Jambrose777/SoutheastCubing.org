-- One-time promotion of everyone already on record as a Team/Board member
-- (current or past) as of this migration to true, and everyone else to
-- false - matches what promoteToManagedPhoto() would have set for each
-- promoted person had they been added after this story shipped.
UPDATE people
SET has_managed_photo = EXISTS (
  SELECT 1 FROM team_memberships WHERE team_memberships.people_id = people.id
);
