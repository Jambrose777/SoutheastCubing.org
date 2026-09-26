-- Sets has_managed_photo's default now that every existing row (0036) is
-- non-null - future INSERTs that don't specify it land on false
-- automatically, matching every new people row's actual starting state
-- (never promoted until addMember()'s promoteToManagedPhoto() call).
ALTER TABLE people ALTER COLUMN has_managed_photo SET DEFAULT false;
