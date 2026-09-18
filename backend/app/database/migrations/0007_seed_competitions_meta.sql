INSERT INTO competitions_meta (id, last_checked)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;
