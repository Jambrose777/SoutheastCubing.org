-- One-time historical seed of the Delegate roster, from the org's own
-- tracking spreadsheet. Every person upserted into `people` by wca_id 
-- first (safe even if someone already has a real row under a different 
-- id, e.g. from having already logged in, or a previous seeding).

INSERT INTO people (id, wca_id, name)
VALUES
  ('dd58f313-2948-4498-ad40-b361d43708ad', '2010HULL01', 'Katie Hull'),
  ('a21bf24f-0b0e-42ad-acd8-7c381cb2657d', '2010AMBR01', 'Jacob Ambrose'),
  ('233f7535-f54e-4d75-80f4-bc70f0205fbb', '2014SHIE03', 'Cady Shields'),
  ('9baa6768-0085-41c3-8b13-c4fc6ab61218', '2017HART11', 'Nancy Hartman'),
  ('591f130c-dfe7-4c05-842a-11e1b569219d', '2014STIN01', 'Jared Stinson'),
  ('ca25edb1-424d-44e6-9bdc-76d5adfa1d50', '2014GOSL01', 'Raymond Goslow'),
  ('b1eec47f-0192-4d9b-952d-27a481cfb22c', '2016BITZ01', 'Carter Bitz'),
  ('bfe137d8-dbce-4792-afa6-7708d4355d37', '2017WOFF01', 'Roman Wofford'),
  ('4365ba36-8a9a-4499-a21c-79e125c96b9f', '2017MOOR03', 'Clay Moore'),
  ('e32b634a-3c8f-4317-9bc3-3e4cfa7ff41f', '2019JOHN03', 'Roxana Johnson'),
  ('3a8740cd-8326-4da3-b606-58ead7022124', '2016PHUN02', 'Lauren Phung'),
  ('79b72a5e-715c-4b0d-a41d-4957c458faf3', '2014GRAV02', 'Nathan Graves'),
  ('1fb59054-df49-4a8a-a134-9d1a4f9ff7cb', '2015PADG01', 'Dalton Padgett'),
  ('1e35b23a-7c30-4226-8d06-a24ebc82b35c', '2013BARK01', 'Justin Barker'),
  ('1867f10a-f7a2-408e-8a43-ac994e04524d', '2016CLIP01', 'Rue Clippinger'),
  ('77136875-8183-486c-a17c-51042fb59ff9', '2015LANE01', 'Phil Lane'),
  ('c6fb44d2-c592-4370-adef-c043a8d278c1', '2017COOL02', 'Addy Coolidge'),
  ('a2fcbc60-930f-467a-9245-3784d7c1aa05', '2015VERO02', 'Kevin Veronneau'),
  ('e414d640-1729-47db-9cce-c61ea33a8c18', '2008CLEM01', 'Kit Clement'),
  ('cbb86b1e-9417-4534-be5f-ae1fe7f3e5e3', '2016OCHS01', 'Zachary Ochs'),
  ('82b41822-de75-4abe-84ce-4757108f308a', '2017PLEI01', 'Coleton Pleiss'),
  ('178d7fb7-18cd-474b-84b2-97290e8ffe11', '2011DWYE02', 'Nathan Dwyer'),
  ('7a95de59-1b85-4ffa-ac76-741c4d0736f9', '2003HARD01', 'Chris Hardwick'),
  ('be4b891e-f5dd-497f-9b1c-2c2d1998c04c', '2008TRAN02', 'Chris Tran'),
  ('262ab368-0899-4830-a04e-f6cab3496080', '2010LACH01', 'James LaChance'),
  ('89a70dba-3def-420e-aad0-f32a6f81ec11', '2009LIAN03', 'Chester Lian'),
  ('95de130e-d231-4474-a201-645afc14a805', '2006KANG01', 'Andrew Kang'),
  ('2381b2aa-d425-4246-bc52-98b34dbea091', '2005BLAN01', 'Brandon Blankenship'),
  ('12233ead-8f1d-4b69-acff-5e828fe740db', '2017MEAD01', 'Alison Meador'),
  ('7a75e375-8425-4c07-a464-bab13dced85e', '2018JOHN03', 'Elmer Alexander Johnsen')
ON CONFLICT (wca_id) DO NOTHING;
