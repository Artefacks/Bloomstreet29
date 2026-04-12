-- Ordres au marché passés hors séance : exécutés à l’ouverture (market_deferred).
ALTER TABLE public.pending_orders
  ADD COLUMN IF NOT EXISTS market_deferred boolean NOT NULL DEFAULT false;
