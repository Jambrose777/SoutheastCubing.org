-- Renames this column to match the "volunteer" terminology used everywhere
ALTER TABLE competitions RENAME COLUMN is_in_staff_application TO is_in_volunteer_application;
