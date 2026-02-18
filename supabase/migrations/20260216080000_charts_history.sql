-- Historique pour graphiques: capital joueur + prix des instruments

-- Historique des prix (append à chaque refresh)
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  price numeric(18,4) not null,
  as_of timestamptz not null default now()
);

create index if not exists idx_price_history_symbol_as_of on public.price_history(symbol, as_of desc);

-- Snapshots de la valorisation totale d'un joueur (append à chaque trade)
create table if not exists public.player_equity_snapshots (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_value numeric(18,4) not null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_equity_snapshots_game_user_time on public.player_equity_snapshots(game_id, user_id, recorded_at desc);

-- RLS
alter table public.price_history enable row level security;
alter table public.player_equity_snapshots enable row level security;

-- price_history: lecture publique (comme prices_latest)
create policy "price_history_select_all"
  on public.price_history for select using (true);

-- price_history: écriture par service role uniquement (côté refresh API)
-- Pas de policy INSERT pour les users anon/authenticated = seul le service role peut écrire

-- player_equity_snapshots: lecture pour membres de la partie
create policy "equity_snapshots_select_member"
  on public.player_equity_snapshots for select
  using (
    game_id in (select public.get_my_game_ids())
  );

-- player_equity_snapshots: insert pour les membres (côté API trade)
create policy "equity_snapshots_insert_member"
  on public.player_equity_snapshots for insert
  with check (
    game_id in (select public.get_my_game_ids())
    and user_id = auth.uid()
  );
