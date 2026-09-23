-- Historical team_leaders data - Software Team (Jacob Ambrose) and Clubs
-- Team (Raymond Goslow). Joins on wca_id (not a hardcoded
-- people_id), same reasoning as 0032.
INSERT INTO team_leaders (id, team_id, people_id, start_date)
SELECT v.id, v.team_id, p.id, v.start_date
FROM (
  VALUES
    ('bf253554-5c51-41d1-a188-5584581573a7', 'software_team', '2010AMBR01', DATE '2026-01-17'),
    ('ba02364f-81bc-4597-ab9b-fdedc530a596', 'clubs_team', '2014GOSL01', DATE '2026-01-17')
) AS v (id, team_id, wca_id, start_date)
JOIN people p ON p.wca_id = v.wca_id
ON CONFLICT (id) DO NOTHING;
