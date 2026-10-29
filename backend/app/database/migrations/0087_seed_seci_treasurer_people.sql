-- Seed the SECI Treasurer person if this WCA account is not already present.
INSERT INTO people (id, wca_user_id, name)
VALUES ('86b8fd1b-603a-4e43-abcb-6df35cf1340a', '446810', 'SECI Treasurer')
ON CONFLICT (wca_user_id) DO NOTHING;