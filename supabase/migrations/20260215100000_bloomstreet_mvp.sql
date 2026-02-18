-- Bloomstreet 29 MVP: games, game_players, instruments, prices_latest, positions, orders

-- Games: une partie de trading
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  join_code text not null unique,
  duration_days int not null default 7,
  initial_cash numeric(18,2) not null default 100000,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- Joueurs d'une partie
create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  cash numeric(18,2) not null default 100000,
  joined_at timestamptz not null default now(),
  unique(game_id, user_id)
);

-- Instruments tradables (symbol + nom)
create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text,
  created_at timestamptz not null default now()
);

-- Derniers prix (mis à jour par cron /api/prices/refresh)
create table if not exists public.prices_latest (
  symbol text primary key,
  price numeric(18,4) not null,
  as_of timestamptz not null default now(),
  source text default 'finnhub'
);

-- Positions par joueur et symbole (par partie)
create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  qty numeric(18,4) not null default 0,
  avg_cost numeric(18,4) not null default 0,
  unique(game_id, user_id, symbol)
);

-- Ordres (historique)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  qty numeric(18,4) not null,
  price numeric(18,4) not null,
  created_at timestamptz not null default now()
);

-- Index
create index if not exists idx_game_players_game on public.game_players(game_id);
create index if not exists idx_game_players_user on public.game_players(user_id);
create index if not exists idx_positions_game_user on public.positions(game_id, user_id);
create index if not exists idx_orders_game on public.orders(game_id);

-- RLS
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.instruments enable row level security;
alter table public.prices_latest enable row level security;
alter table public.positions enable row level security;
alter table public.orders enable row level security;

-- games: lecture pour membres
create policy "games_select_member"
  on public.games for select
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = games.id and gp.user_id = auth.uid()
    )
  );
-- games: création par tout utilisateur connecté
create policy "games_insert_authenticated"
  on public.games for insert
  with check (auth.uid() is not null);

-- game_players: lecture pour membres de la partie
create policy "game_players_select_member"
  on public.game_players for select
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = game_players.game_id and gp.user_id = auth.uid()
    )
  );
create policy "game_players_insert_authenticated"
  on public.game_players for insert
  with check (auth.uid() = user_id);
create policy "game_players_update_self"
  on public.game_players for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- instruments: lecture publique
create policy "instruments_select_all"
  on public.instruments for select using (true);

-- prices_latest: lecture publique (pas de clé secrète côté client, les prix sont lus via API)
create policy "prices_latest_select_all"
  on public.prices_latest for select using (true);

-- positions: lecture/écriture pour membres de la partie (mise à jour par API serveur)
create policy "positions_select_member"
  on public.positions for select
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = positions.game_id and gp.user_id = auth.uid()
    )
  );
create policy "positions_insert_member"
  on public.positions for insert
  with check (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = positions.game_id and gp.user_id = auth.uid()
    )
    and user_id = auth.uid()
  );
create policy "positions_update_member"
  on public.positions for update
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = positions.game_id and gp.user_id = auth.uid()
    )
  );
create policy "positions_delete_member"
  on public.positions for delete
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = positions.game_id and gp.user_id = auth.uid()
    )
  );

-- orders: lecture pour membres
create policy "orders_select_member"
  on public.orders for select
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = orders.game_id and gp.user_id = auth.uid()
    )
  );
create policy "orders_insert_member"
  on public.orders for insert
  with check (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = orders.game_id and gp.user_id = auth.uid()
    )
    and user_id = auth.uid()
  );
