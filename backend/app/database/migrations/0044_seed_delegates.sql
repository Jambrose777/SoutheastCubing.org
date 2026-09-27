-- One-time historical seed of the Delegate roster, from the org's own
-- tracking spreadsheet. Every person upserted into `delegates` by wca_id 
-- first (safe even if someone already has a real row under a different 
-- id).

INSERT INTO delegates (id, people_id)
SELECT v.id, p.id
FROM (
  VALUES
  ('0af6a1d8-0a6d-4b96-901b-033ad86fa4dc', '2010HULL01'),
  ('ae95bab9-fb6b-4eaf-8f9c-e7d59e6b69e1', '2010AMBR01'),
  ('ca1a9f1b-41a3-4297-8dc5-4521f85ae357', '2014SHIE03'),
  ('b9dbfb81-d983-44f4-9755-f7eb54f055aa', '2017HART11'),
  ('ee1d6ec0-4a22-427c-be9c-87b187fcd86d', '2014STIN01'),
  ('d44276fa-24cb-4506-a583-bfd4e1c2df55', '2014GOSL01'),
  ('9ec67b2f-771c-4a65-ba3e-626f6ed24fd0', '2016BITZ01'),
  ('bd869e9d-c48d-4fda-afec-bcdfb0857563', '2017WOFF01'),
  ('2c2eef6e-34b2-411e-bc94-e339cacdcd8d', '2017MOOR03'),
  ('0362ade5-b99a-4746-be6a-fb156b2983c0', '2019JOHN03'),
  ('c326a466-2d3f-47f4-9cbe-d310d04e5404', '2016PHUN02'),
  ('5f411b27-70c4-4006-a7d6-27ef4ff66147', '2014GRAV02'),
  ('aa022043-f70f-4a1b-ba3a-36b158b651ee', '2015PADG01'),
  ('330ec6d0-69ef-41d4-9615-3e17219f42f6', '2013BARK01'),
  ('049a7fe2-4ab7-4ee4-9bee-d66355643ea7', '2016CLIP01'),
  ('c7a1d988-e19d-45ab-9216-53cb1a824b0a', '2015LANE01'),
  ('6937f25f-774c-4bed-adfc-5ae8dd994e88', '2017COOL02'),
  ('48bd46ac-055e-4cfc-b2c4-e2e007c0bf9e', '2015VERO02'),
  ('9abdf0fb-dfac-4f4f-a7c5-37b7093cda8c', '2008CLEM01'),
  ('4dafd809-67e4-4fec-b059-8af879f6e765', '2016OCHS01'),
  ('93247070-457a-425e-af33-8e16857a7f6c', '2017PLEI01'),
  ('112321bd-61dc-4b46-a50b-9a886b369481', '2011DWYE02'),
  ('73c92537-8394-4647-8d12-6029bdcb1a3f', '2003HARD01'),
  ('94415a5a-ad33-41e7-8c0f-cd57142a896e', '2008TRAN02'),
  ('5f02614e-940c-4c76-8dec-1bf24bc60c39', '2010LACH01'),
  ('8b8b0c12-e560-48ce-ad85-af38da57b5c0', '2009LIAN03'),
  ('5c769f72-54cc-40db-b66f-1246831586bd', '2006KANG01'),
  ('a44d486b-a6ca-4fb4-90e5-dd99c526011f', '2005BLAN01'),
  ('2fa6c638-d92e-4570-b34f-8b65d8429ef6', '2017MEAD01')
) AS v (id, wca_id)
JOIN people p ON p.wca_id = v.wca_id
ON CONFLICT (people_id) DO NOTHING;
