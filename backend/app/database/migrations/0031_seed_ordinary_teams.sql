-- Seeds the three ordinary teams referenced by the historical membership
-- migrations that follow (0032/0033) - freely creatable/archivable
-- teams, unlike the fixed rows in 0028.
INSERT INTO teams (id, name, description, email, hidden) VALUES
  (
    'clubs_team',
    'Clubs Team',
    'This team supports local cubing clubs in the Southeast.',
    'clubs@southeastcubing.org',
    false
  ),
  (
    'social_media_team',
    'Social Media Team',
    'This team manages the social media presence of Southeast Cubing.',
    NULL,
    false
  ),
  (
    'software_team',
    'Software Team',
    'This team develops the southeastcubing.org website.',
    NULL,
    false
  )
ON CONFLICT (id) DO NOTHING;
