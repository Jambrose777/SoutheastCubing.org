-- Marks whether a person has ever been promoted into a managed photo (their
-- WCA avatar mirrored into our own storage, editable/croppable) - true
-- permanently once set, never re-derived from team_memberships or any other
-- table at read time. A person never promoted just has picture_url point at
-- their live WCA avatar URL instead.
ALTER TABLE people ADD COLUMN has_managed_photo BOOLEAN;
