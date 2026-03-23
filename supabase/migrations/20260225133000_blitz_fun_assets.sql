-- Blitz mode: add extra fun non-crypto assets (solo-friendly variety)

INSERT INTO public.instruments (symbol, name, seed_price, exchange_suffix, blitz_only)
VALUES
  ('PIZZA.BLITZ', 'Pizza Index', 12.50, '.BLITZ', true),
  ('NINJA.BLITZ', 'Ninja Moves', 8.80, '.BLITZ', true),
  ('LASER.BLITZ', 'Laser Beam', 24.00, '.BLITZ', true),
  ('ZOMBIE.BLITZ', 'Zombie Panic', 6.40, '.BLITZ', true),
  ('UNICORN.BLITZ', 'Unicorn Dreams', 31.20, '.BLITZ', true),
  ('TURBO.BLITZ', 'Turbo Boost', 18.90, '.BLITZ', true),
  ('SPACE.BLITZ', 'Space Odyssey', 44.40, '.BLITZ', true),
  ('CHAOS.BLITZ', 'Chaos Engine', 15.70, '.BLITZ', true)
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  seed_price = EXCLUDED.seed_price,
  exchange_suffix = EXCLUDED.exchange_suffix,
  blitz_only = EXCLUDED.blitz_only;

INSERT INTO public.prices_latest (symbol, price, as_of, source)
VALUES
  ('PIZZA.BLITZ', 12.50, now(), 'sim'),
  ('NINJA.BLITZ', 8.80, now(), 'sim'),
  ('LASER.BLITZ', 24.00, now(), 'sim'),
  ('ZOMBIE.BLITZ', 6.40, now(), 'sim'),
  ('UNICORN.BLITZ', 31.20, now(), 'sim'),
  ('TURBO.BLITZ', 18.90, now(), 'sim'),
  ('SPACE.BLITZ', 44.40, now(), 'sim'),
  ('CHAOS.BLITZ', 15.70, now(), 'sim')
ON CONFLICT (symbol) DO UPDATE SET
  price = EXCLUDED.price,
  as_of = EXCLUDED.as_of,
  source = EXCLUDED.source;
