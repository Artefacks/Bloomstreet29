-- Seed price for international stocks (used as anchor for mean-reversion in simulation).
-- Prevents simulated prices from drifting too far from reality over multi-day games.

ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS seed_price numeric(18,4);

COMMENT ON COLUMN public.instruments.seed_price IS 'Reference price for simulation mean-reversion. Set once from real market data.';
