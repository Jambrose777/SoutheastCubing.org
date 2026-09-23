-- Grants Jacob Ambrose (software team) Admin access - per the "Admin is
-- migration-only" rule. Matches the `people` row by wca_id (not a fixed 
-- id) so this still resolves correctly even if he'd already logged in 
-- for real before 0029 ran.
INSERT INTO team_memberships (id, team_id, people_id)
SELECT '061ec7f8-af2a-4f08-b487-b082e897036e', 'admin', p.id
FROM people p
WHERE p.wca_id = '2010AMBR01'
ON CONFLICT (id) DO NOTHING;
