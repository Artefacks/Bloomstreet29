-- Profil utilisateur : nom affiché et avatar/personnage
-- Rempli après la première connexion (onboarding)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar text,
  updated_at timestamptz not null default now()
);

comment on column public.profiles.display_name is 'Nom choisi par le joueur (ex. "TraderPro", "Marie")';
comment on column public.profiles.avatar is 'Code avatar (ex. "bull", "bear", "fox")';

alter table public.profiles enable row level security;

-- Avatar dans game_players pour afficher dans le classement
alter table public.game_players
  add column if not exists avatar text;

comment on column public.game_players.avatar is 'Code avatar copié du profil à l''insertion.';

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
