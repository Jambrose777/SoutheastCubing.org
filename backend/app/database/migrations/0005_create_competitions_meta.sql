-- Single-row table tracking when competitions were last refreshed from WCA.
-- The id=1 check keeps it from ever holding more than one row.
CREATE TABLE IF NOT EXISTS competitions_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_checked TIMESTAMPTZ
);
