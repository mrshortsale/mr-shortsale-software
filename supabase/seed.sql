-- Seed demo users (password: demo2026, hashed with bcrypt via pgcrypto)
-- Run AFTER the migration.

INSERT INTO public.users (email, name, password_hash, role, avatar_color)
VALUES
  (
    'cristina@mrshortsale.net',
    'Cristina Gaspar',
    crypt('demo2026', gen_salt('bf')),
    'ceo',
    '#042C53'
  ),
  (
    'maria@mrshortsale.net',
    'Maria Santos',
    crypt('demo2026', gen_salt('bf')),
    'rep',
    '#0F6E56'
  ),
  (
    'james@mrshortsale.net',
    'James Rivera',
    crypt('demo2026', gen_salt('bf')),
    'rep',
    '#185FA5'
  ),
  (
    'luis@mrshortsale.net',
    'Luis Ortega',
    crypt('demo2026', gen_salt('bf')),
    'rep',
    '#854F0B'
  )
ON CONFLICT DO NOTHING;
