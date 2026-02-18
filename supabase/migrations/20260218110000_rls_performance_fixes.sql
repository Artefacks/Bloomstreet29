-- Fix Supabase linter warnings: auth_rls_initplan + multiple_permissive_policies
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- 1. games: wrap auth.uid() in (select ...) + consolidate SELECT policies
DROP POLICY IF EXISTS "games_select_member" ON public.games;
DROP POLICY IF EXISTS "games_select_authenticated_join" ON public.games;

CREATE POLICY "games_select_authenticated"
  ON public.games FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "games_insert_authenticated" ON public.games;
CREATE POLICY "games_insert_authenticated"
  ON public.games FOR INSERT
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- 2. game_players
DROP POLICY IF EXISTS "game_players_insert_authenticated" ON public.game_players;
CREATE POLICY "game_players_insert_authenticated"
  ON public.game_players FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "game_players_update_self" ON public.game_players;
CREATE POLICY "game_players_update_self"
  ON public.game_players FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- get_my_game_ids: wrap auth.uid() for initplan
CREATE OR REPLACE FUNCTION public.get_my_game_ids()
RETURNS setof uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT game_id FROM public.game_players WHERE user_id = (select auth.uid());
$$;

-- 3. positions
DROP POLICY IF EXISTS "positions_select_member" ON public.positions;
CREATE POLICY "positions_select_member"
  ON public.positions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = positions.game_id AND gp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "positions_insert_member" ON public.positions;
CREATE POLICY "positions_insert_member"
  ON public.positions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = positions.game_id AND gp.user_id = (select auth.uid())
    )
    AND user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "positions_update_member" ON public.positions;
CREATE POLICY "positions_update_member"
  ON public.positions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = positions.game_id AND gp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "positions_delete_member" ON public.positions;
CREATE POLICY "positions_delete_member"
  ON public.positions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = positions.game_id AND gp.user_id = (select auth.uid())
    )
  );

-- 4. orders
DROP POLICY IF EXISTS "orders_select_member" ON public.orders;
CREATE POLICY "orders_select_member"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = orders.game_id AND gp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "orders_insert_member" ON public.orders;
CREATE POLICY "orders_insert_member"
  ON public.orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = orders.game_id AND gp.user_id = (select auth.uid())
    )
    AND user_id = (select auth.uid())
  );

-- 5. pending_orders
DROP POLICY IF EXISTS "pending_orders_select_own" ON public.pending_orders;
CREATE POLICY "pending_orders_select_own"
  ON public.pending_orders FOR SELECT
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "pending_orders_insert_own" ON public.pending_orders;
CREATE POLICY "pending_orders_insert_own"
  ON public.pending_orders FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "pending_orders_update_own" ON public.pending_orders;
CREATE POLICY "pending_orders_update_own"
  ON public.pending_orders FOR UPDATE
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- 6. game_end_prices
DROP POLICY IF EXISTS "game_end_prices_select_member" ON public.game_end_prices;
CREATE POLICY "game_end_prices_select_member"
  ON public.game_end_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.game_id = game_end_prices.game_id AND gp.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "game_end_prices_insert_creator" ON public.game_end_prices;
CREATE POLICY "game_end_prices_insert_creator"
  ON public.game_end_prices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_end_prices.game_id AND g.created_by = (select auth.uid())
    )
  );

-- 7. player_equity_snapshots (get_my_game_ids already fixed above)
DROP POLICY IF EXISTS "equity_snapshots_insert_member" ON public.player_equity_snapshots;
CREATE POLICY "equity_snapshots_insert_member"
  ON public.player_equity_snapshots FOR INSERT
  WITH CHECK (
    game_id IN (SELECT public.get_my_game_ids())
    AND user_id = (select auth.uid())
  );
