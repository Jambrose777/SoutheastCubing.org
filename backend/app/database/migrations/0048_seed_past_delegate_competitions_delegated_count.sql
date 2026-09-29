-- One-time seed of competitions_delegated_count for past Delegates whose
-- count was never backfilled (the nightly sync only refreshes it for
-- current Delegates.
UPDATE delegates
SET competitions_delegated_count = v.count
FROM (
  VALUES
  ('2017MEAD01', 23),
  ('2006KANG01', 2),
  ('2005BLAN01', 1),
  ('2009LIAN03', 12),
  ('2003HARD01', 21),
  ('2008TRAN02', 26),
  ('2010LACH01', 22),
  ('2011DWYE02', 50)
) AS v (wca_id, count)
JOIN people p ON p.wca_id = v.wca_id
WHERE delegates.people_id = p.id;
