-- Seeds `people` rows for everyone the historical Team/Board data (0030,
-- 0032/0033) references. Each with its real WCA ID, so a future WCA login 
-- by any of them claims (updates) this same row instead of creating a 
-- duplicate one.
--
-- Conflicts on wca_id (not id) - safe even if any of these twelve had
-- already logged in for real by the time this runs, in which case that
-- pre-existing row (under its own, different id) is left as-is. Every later
-- migration that needs to reference one of these people looks them up by
-- wca_id rather than hardcoding the UUID below, so it still resolves
-- correctly in that case too.
INSERT INTO people (id, wca_id, name)
VALUES
  ('34d1635c-93ab-49e8-883b-ce80a5174be5', '2010AMBR01', 'Jacob Ambrose'),
  ('d09abe0d-3970-4ccb-bc30-d4a3c4b2ecca', '2017MOOR03', 'Clay Moore'),
  ('36ce029e-cbe0-4383-94f3-04289e11f460', '2017WOFF01', 'Roman Wofford'),
  ('7d8ba261-9f62-4162-a305-a42ca35651ee', '2019JOHN03', 'Roxana Johnson'),
  ('f42d14fe-ad61-4f2b-99de-859b40bbb26d', '2014SHIE03', 'Cady Shields'),
  ('5a067de9-7172-46b1-b043-03f82f5ab300', '2010HULL01', 'Katie Hull'),
  ('40e47d42-c36e-4bb8-84d1-93ae02f81650', '2017HART11', 'Nancy Hartman'),
  ('8af8981a-3240-4c5e-b19b-73f36d5854b0', '2014GOSL01', 'Raymond Goslow'),
  ('46dd0de1-e332-4ec4-bc89-2fae75132b83', '2013BARK01', 'Justin Barker'),
  ('4f40d9c3-1f49-46d1-b6ad-7657623549da', '2023PAIK02', 'Jack Paik'),
  ('bfaa4923-1fca-4abb-9b9b-c8997be07be4', '2018SMIT40', 'Nathan Smith'),
  ('eca2fb87-b928-4cf7-b76e-ca085f85cc56', '2018AMAD01', 'Sebastian Amador')
ON CONFLICT (wca_id) DO NOTHING;
