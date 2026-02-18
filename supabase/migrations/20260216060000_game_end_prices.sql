-- Snapshot des prix en fin de partie (pour top/worst trade et classement final figé)

create table if not exists public.game_end_prices (
  game_id uuid not null references public.games(id) on delete cascade,
  symbol text not null,
  price numeric(18,4) not null,
  primary key (game_id, symbol)
);

create index if not exists idx_game_end_prices_game on public.game_end_prices(game_id);

alter table public.game_end_prices enable row level security;

-- Lecture pour les membres de la partie (même politique que games)
create policy "game_end_prices_select_member"
  on public.game_end_prices for select
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = game_end_prices.game_id and gp.user_id = auth.uid()
    )
  );

-- Écriture par service role ou créateur (pour snapshot); on utilise une policy insert pour les créateurs
create policy "game_end_prices_insert_creator"
  on public.game_end_prices for insert
  with check (
    exists (
      select 1 from public.games g
      where g.id = game_end_prices.game_id and g.created_by = auth.uid()
    )
  );
