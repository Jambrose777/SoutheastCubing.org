-- One-time historical seed of the Delegate roster, from the org's own
-- tracking spreadsheet. This inserts each Delegate's state stint.

INSERT INTO delegate_state_history (id, delegate_id, state, start_date, end_date)
SELECT v.id, d.id, v.state, v.start_date, v.end_date
FROM (
  VALUES
  ('5aee1475-55f1-4026-a775-6e986b1551d5', '2010HULL01', 'Georgia', DATE '2017-11-14', NULL::date),
  ('fe3fbb17-af0b-4fac-ae78-1c59826eba5a', '2010AMBR01', 'Georgia', DATE '2016-08-05', NULL::date),
  ('1e664772-066b-4946-b659-c7446655b1ff', '2014SHIE03', 'North Carolina', DATE '2018-02-21', NULL::date),
  ('9e113c0f-59ab-4400-a546-8a151ac43031', '2017HART11', 'Florida', DATE '2018-11-22', NULL::date),
  ('416595e3-30bc-4502-a376-7031d8a80e67', '2014STIN01', 'Alabama', DATE '2018-11-28', NULL::date),
  ('5c065aae-001f-442d-ba0b-2b057db7d0ff', '2014GOSL01', 'Georgia', DATE '2021-07-23', NULL::date),
  ('d3aa907e-b926-4f9d-a848-e53540568c78', '2016BITZ01', 'Florida', DATE '2022-08-01', NULL::date),
  ('48213e9b-6948-4697-b523-99347c85206f', '2017WOFF01', 'Alabama', DATE '2023-03-09', NULL::date),
  ('24825916-90db-453e-a564-958495b637ca', '2017MOOR03', 'Georgia', DATE '2023-03-09', NULL::date),
  ('5071fc28-e953-4359-809c-ac9e04ece61d', '2019JOHN03', 'Tennessee', DATE '2023-08-23', NULL::date),
  ('d2afa7bc-30dc-470d-975f-cfdef30e2b84', '2016PHUN02', 'North Carolina', DATE '2026-07-06', NULL::date),
  ('2bc13a90-f883-45dc-b44c-72a8f9762c04', '2014GRAV02', 'Florida', DATE '2021-09-01', NULL::date),
  ('007cd596-9335-4b4b-a41f-ee18e9bdea63', '2015PADG01', 'North Carolina', DATE '2023-03-09', NULL::date),
  ('8c4faa06-3d81-4028-84fd-7b525a4d1bf2', '2013BARK01', 'Georgia', DATE '2025-04-18', NULL::date),
  ('1b184ac4-8e42-488a-bdc4-7eb4ee9da2d8', '2016CLIP01', 'North Carolina', DATE '2025-08-05', NULL::date),
  ('c8202bd8-f4a5-4e86-9e13-7fe147a38ff4', '2015LANE01', 'Alabama', DATE '2026-05-02', NULL::date),
  ('7d52ed7a-3439-4e6f-9bca-276797b29b46', '2017COOL02', 'North Carolina', DATE '2026-02-01', NULL::date),
  ('cc7e6fd7-b462-4cbc-966b-fc624b994b2d', '2015VERO02', 'South Carolina', DATE '2025-12-01', NULL::date),
  ('afd6bbf1-0a88-47b9-838a-00c25f409fac', '2016OCHS01', 'North Carolina', DATE '2021-07-23', DATE '2026-08-10'),
  ('80a6f12d-9d31-44c0-8475-b774d772e9c9', '2017PLEI01', 'Florida', DATE '2023-08-01', DATE '2024-12-31'),
  ('6581b4fa-fb5b-4e7f-b3f7-24d43fbc244f', '2011DWYE02', 'Florida', DATE '2022-08-01', DATE '2023-10-04'),
  ('85277b2f-4653-47ad-a668-db33dea412bf', '2003HARD01', 'North Carolina', DATE '2006-03-11', DATE '2010-04-10'),
  ('b4436b11-a24d-48fb-9c6d-9fac7d6eae93', '2003HARD01', 'Florida', DATE '2010-04-10', DATE '2013-02-09'),
  ('39ed4188-17e8-4451-8cc3-72cc9f5f45fa', '2003HARD01', 'Georgia', DATE '2016-06-13', DATE '2019-05-22'),
  ('d61b3820-c89f-4018-95dc-454fbc582238', '2008TRAN02', 'Georgia', DATE '2016-08-05', DATE '2017-08-19'),
  ('44aa661f-65ad-413f-aa9d-692a830ff706', '2010LACH01', 'Florida', DATE '2015-01-13', DATE '2018-09-21'),
  ('2b196bb9-189c-4c6f-ae6b-70877bf60966', '2009LIAN03', 'North Carolina', DATE '2014-06-25', DATE '2018-04-07'),
  ('987bb377-8959-46de-8513-ac96f1224873', '2006KANG01', 'Georgia', DATE '2010-07-31', DATE '2010-07-31'),
  ('2c250136-3f3a-4351-9c05-56c0b2ad7c06', '2006KANG01', 'Georgia', DATE '2011-07-30', DATE '2011-07-30'),
  ('2d80336c-8536-431d-b0ae-7dc83c38e6db', '2005BLAN01', 'Florida', DATE '2008-05-17', DATE '2008-12-01'),
  ('00e8f238-4e68-49fd-a54b-464e32d9e624', '2017MEAD01', 'Kentucky', DATE '2022-10-15', DATE '2022-12-31')
) AS v (id, wca_id, state, start_date, end_date)
JOIN people p ON p.wca_id = v.wca_id
JOIN delegates d ON d.people_id = p.id
ON CONFLICT (id) DO NOTHING;
