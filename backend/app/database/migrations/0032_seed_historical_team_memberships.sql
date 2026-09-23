-- Historical team_memberships data: Board, the three Officer stints
-- (President/Treasurer/Secretary, including past/ended ones so the full
-- history is reconstructable), and the ordinary Software/Clubs/Social Media
-- teams seeded in 0031 (the Social Media rows carry their per-team
-- special_role tags). Real start dates from the org's own records, not the
-- migration run date, so history reads correctly from day one. Joins on 
-- wca_id (not a hardcoded people_id) so this still resolves correctly even 
-- if any of these members had already logged in for real, under their own 
-- different people.id, before 0029 ran. Colors are the org's own real
-- per-role/per-person color-coding.
INSERT INTO team_memberships (id, team_id, people_id, start_date, end_date, special_role, color)
SELECT v.id, v.team_id, p.id, v.start_date, v.end_date, v.special_role, v.color
FROM (
  VALUES
    -- Board
    ('ea0626f0-79a5-4e19-a44b-37647ec9994c', 'board', '2017MOOR03', DATE '2024-07-09', NULL::date, NULL::text, NULL::text),
    ('0bf19575-12c3-489c-91fb-019f171125a9', 'board', '2017WOFF01', DATE '2024-07-09', NULL::date, NULL::text, NULL::text),
    ('7a2246a9-5d39-4184-a0d1-3d209b8c245b', 'board', '2019JOHN03', DATE '2024-07-09', NULL::date, NULL::text, NULL::text),
    ('a56b2f94-abf4-46c2-ab96-fb5677f16019', 'board', '2014SHIE03', DATE '2024-07-09', NULL::date, NULL::text, NULL::text),
    ('538008d3-4a3c-48e1-81a8-17bfcecd45e1', 'board', '2010HULL01', DATE '2024-07-09', NULL::date, NULL::text, NULL::text),
    ('57f76039-0abc-4a07-88a7-70c1dda016cb', 'board', '2017HART11', DATE '2024-07-09', NULL::date, NULL::text, NULL::text),
    ('6a952362-6ede-406c-aa6c-91f79da8b595', 'board', '2014GOSL01', DATE '2024-07-09', NULL::date, NULL::text, NULL::text),
    ('7f5ae7d5-2c19-470d-9a5e-839cda2da1f8', 'board', '2013BARK01', DATE '2026-07-21', NULL::date, NULL::text, NULL::text),
    -- Officers (President/Treasurer/Secretary)
    ('c8a94b20-2378-4e6d-b1fa-7d51efb12596', 'officer_president', '2017MOOR03', DATE '2024-07-09', DATE '2026-01-17', NULL::text, 'purple'),
    ('b9b704fc-dd63-44f3-b1cb-4b4e747215a3', 'officer_president', '2017WOFF01', DATE '2026-01-17', NULL::date, NULL::text, 'purple'),
    ('19fe66d0-9fb8-4944-b3fa-a2a851ad4111', 'officer_treasurer', '2017WOFF01', DATE '2024-07-09', DATE '2026-01-17', NULL::text, 'red'),
    ('0fed919b-a5b5-49b5-919a-6fc67201a2b0', 'officer_treasurer', '2014GOSL01', DATE '2026-01-17', NULL::date, NULL::text, 'red'),
    ('2a7827fd-d3ba-4a5f-99e3-377ae6513dd2', 'officer_secretary', '2019JOHN03', DATE '2024-07-09', DATE '2026-07-21', NULL::text, 'orange'),
    ('fcf79dcb-c613-457e-b011-8a19498cf579', 'officer_secretary', '2013BARK01', DATE '2026-07-21', NULL::date, NULL::text, 'orange'),
    -- Software Team
    ('e7753aea-af4e-48fa-92b3-cf88a921a207', 'software_team', '2010AMBR01', DATE '2026-01-17', NULL::date, NULL::text, 'green'),
    -- Clubs Team
    ('e79c8c10-8e59-49a9-bb05-3e1493f23ae3', 'clubs_team', '2014GOSL01', DATE '2026-01-17', NULL::date, NULL::text, 'green'),
    ('3fd27e9d-6c5c-4ad7-86cc-f47e31ce96a2', 'clubs_team', '2023PAIK02', DATE '2026-01-17', NULL::date, NULL::text, NULL::text),
    ('be6c464b-397d-4a7a-98bf-c1a5df775550', 'clubs_team', '2018SMIT40', DATE '2026-01-17', NULL::date, NULL::text, NULL::text),
    ('ad8a1d2f-65c6-4c03-9f4c-c730863a6fc8', 'clubs_team', '2018AMAD01', DATE '2026-01-17', NULL::date, NULL::text, NULL::text),
    -- Social Media Team
    ('48e7274f-b90c-412a-8e21-576d0e1d75bd', 'social_media_team', '2014GOSL01', DATE '2026-01-17', NULL::date, 'Facebook/LinkedIn', 'blue'),
    ('879231e7-66c5-4f14-8ff2-82eb3b94e716', 'social_media_team', '2010HULL01', DATE '2026-01-17', NULL::date, 'Instagram/Youtube', 'red'),
    ('f935fb59-1d22-4e75-a231-9ea9ada808e7', 'social_media_team', '2017WOFF01', DATE '2026-01-17', NULL::date, 'Discord', 'purple')
) AS v (id, team_id, wca_id, start_date, end_date, special_role, color)
JOIN people p ON p.wca_id = v.wca_id
ON CONFLICT (id) DO NOTHING;
