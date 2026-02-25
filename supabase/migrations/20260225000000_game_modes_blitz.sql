-- Mode Blitz (1h) + effet de levier
-- game_mode: 'classic' | 'blitz'
-- leverage_multiplier: 1 = normal, 2 = 2x exposure (Blitz)

alter table public.games
  add column if not exists game_mode text not null default 'classic' check (game_mode in ('classic','blitz')),
  add column if not exists leverage_multiplier numeric(4,2) not null default 1 check (leverage_multiplier >= 1 and leverage_multiplier <= 5);

comment on column public.games.game_mode is 'classic = partie classique (jours), blitz = 1h intense';
comment on column public.games.leverage_multiplier is 'Exposition x N sur les positions (Blitz: 2x gains et pertes)';
