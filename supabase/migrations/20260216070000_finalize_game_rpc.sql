-- Finaliser une partie (snapshot des prix) : appelable par tout membre quand ends_at est dépassé.

create or replace function public.finalize_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends_at timestamptz;
  v_status text;
  v_is_member boolean;
begin
  select g.ends_at, g.status
  into v_ends_at, v_status
  from public.games g
  where g.id = p_game_id;

  if v_ends_at is null or v_status is null then
    return;
  end if;

  select exists (
    select 1 from public.game_players gp
    where gp.game_id = p_game_id and gp.user_id = auth.uid()
  ) into v_is_member;

  if not v_is_member then
    return;
  end if;

  if v_status <> 'active' or now() < v_ends_at then
    return;
  end if;

  update public.games set status = 'finished' where id = p_game_id;

  insert into public.game_end_prices (game_id, symbol, price)
  select p_game_id, pl.symbol, pl.price
  from public.prices_latest pl
  where exists (
    select 1 from public.instruments i where i.symbol = pl.symbol
  )
  on conflict (game_id, symbol) do update set price = excluded.price;
end;
$$;
