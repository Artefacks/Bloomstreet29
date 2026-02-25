-- Mode Blitz : instruments gamifiés (faux cours, crypto, meme)
-- blitz_only = true → visible uniquement en mode Blitz
-- exchange_suffix = '.BLITZ' → marché 24/7, volatilité haute

ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS blitz_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.instruments.blitz_only IS 'Si true, instrument visible uniquement en mode Blitz (gamifié, faux cours)';

-- Instruments Blitz : crypto, meme coins, fun assets — tous simulés 24/7
INSERT INTO public.instruments (symbol, name, seed_price, exchange_suffix, blitz_only)
VALUES
  ('BTC.BLITZ', 'Bitcoin', 67500, '.BLITZ', true),
  ('ETH.BLITZ', 'Ethereum', 3450, '.BLITZ', true),
  ('DOGE.BLITZ', 'Dogecoin', 0.42, '.BLITZ', true),
  ('MEME.BLITZ', 'Meme Coin', 0.08, '.BLITZ', true),
  ('MOON.BLITZ', 'Moon Token', 1.25, '.BLITZ', true),
  ('PEPE.BLITZ', 'Pepe Coin', 0.000012, '.BLITZ', true),
  ('SHIB.BLITZ', 'Shiba Inu', 0.000025, '.BLITZ', true),
  ('WOOF.BLITZ', 'Woof Coin', 0.15, '.BLITZ', true),
  ('ROCKET.BLITZ', 'Rocket Fuel', 2.80, '.BLITZ', true),
  ('DIAMOND.BLITZ', 'Diamond Hands', 99.99, '.BLITZ', true),
  ('YOLO.BLITZ', 'YOLO Stock', 42.00, '.BLITZ', true),
  ('LAMBO.BLITZ', 'Lambo Token', 0.69, '.BLITZ', true)
ON CONFLICT (symbol) DO UPDATE SET
  name = EXCLUDED.name,
  seed_price = EXCLUDED.seed_price,
  exchange_suffix = EXCLUDED.exchange_suffix,
  blitz_only = EXCLUDED.blitz_only;

-- Prix initiaux pour les instruments Blitz
INSERT INTO public.prices_latest (symbol, price, as_of, source)
VALUES
  ('BTC.BLITZ', 67500, now(), 'sim'),
  ('ETH.BLITZ', 3450, now(), 'sim'),
  ('DOGE.BLITZ', 0.42, now(), 'sim'),
  ('MEME.BLITZ', 0.08, now(), 'sim'),
  ('MOON.BLITZ', 1.25, now(), 'sim'),
  ('PEPE.BLITZ', 0.000012, now(), 'sim'),
  ('SHIB.BLITZ', 0.000025, now(), 'sim'),
  ('WOOF.BLITZ', 0.15, now(), 'sim'),
  ('ROCKET.BLITZ', 2.80, now(), 'sim'),
  ('DIAMOND.BLITZ', 99.99, now(), 'sim'),
  ('YOLO.BLITZ', 42.00, now(), 'sim'),
  ('LAMBO.BLITZ', 0.69, now(), 'sim')
ON CONFLICT (symbol) DO UPDATE SET
  price = EXCLUDED.price,
  as_of = EXCLUDED.as_of,
  source = EXCLUDED.source;
