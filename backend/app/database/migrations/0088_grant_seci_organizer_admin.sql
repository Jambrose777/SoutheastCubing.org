-- Grants the SECI Treasurer Admin access.
INSERT INTO team_memberships (id, team_id, people_id)
SELECT '7d4d9076-4d6e-4e31-b879-cf04fe3cb544', 'admin', p.id
FROM people p
WHERE p.wca_user_id = '446810'
ON CONFLICT (id) DO NOTHING;