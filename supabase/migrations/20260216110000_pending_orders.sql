-- Pending limit orders: orders that wait for the market price to reach the limit.
-- Checked on every price tick. Executed or expired automatically.

CREATE TABLE IF NOT EXISTS public.pending_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  qty numeric(18,4) NOT NULL,
  limit_price numeric(18,4) NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','filled','cancelled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  filled_at timestamptz,
  cancelled_at timestamptz,
  fill_price numeric(18,4),
  fee_amount numeric(18,4)
);

CREATE INDEX IF NOT EXISTS idx_pending_orders_game ON public.pending_orders(game_id);
CREATE INDEX IF NOT EXISTS idx_pending_orders_open ON public.pending_orders(status) WHERE status = 'open';

ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;

-- Players can see their own pending orders
CREATE POLICY "pending_orders_select_own"
  ON public.pending_orders FOR SELECT
  USING (user_id = auth.uid());

-- Players can insert their own pending orders
CREATE POLICY "pending_orders_insert_own"
  ON public.pending_orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Players can cancel (update) their own open orders
CREATE POLICY "pending_orders_update_own"
  ON public.pending_orders FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
