-- One-time promotion of every current Delegate to has_managed_photo = true.
UPDATE people
SET has_managed_photo = true
WHERE EXISTS (
  SELECT 1 FROM delegates WHERE delegates.people_id = people.id
);
