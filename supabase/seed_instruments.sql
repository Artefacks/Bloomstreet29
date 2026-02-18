-- Seed instruments et prix initiaux pour tests
-- Dans Supabase SQL Editor: coller et exécuter

-- Insérer les instruments
insert into public.instruments (symbol, name) values
  ('AAPL', 'Apple Inc.'),
  ('MSFT', 'Microsoft Corp.'),
  ('GOOGL', 'Alphabet Inc.'),
  ('AMZN', 'Amazon.com Inc.'),
  ('META', 'Meta Platforms Inc.')
on conflict (symbol) do nothing;

-- Insérer les prix initiaux
insert into public.prices_latest (symbol, price, as_of, source) values
  ('AAPL', 195.00, now(), 'manual'),
  ('MSFT', 420.00, now(), 'manual'),
  ('GOOGL', 150.00, now(), 'manual'),
  ('AMZN', 175.00, now(), 'manual'),
  ('META', 480.00, now(), 'manual')
on conflict (symbol) do update set
  price = excluded.price,
  as_of = excluded.as_of,
  source = excluded.source;
