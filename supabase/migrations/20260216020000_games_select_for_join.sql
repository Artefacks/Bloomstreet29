-- Fix: Permettre à un joueur de trouver une partie par join_code pour pouvoir rejoindre.
--
-- Problème: La politique "games_select_member" autorise la lecture seulement si
-- l'utilisateur est déjà dans game_players. Un nouveau joueur qui entre le code
-- ne peut donc jamais voir la partie → "Aucune partie avec ce code".
--
-- Solution: Autoriser tout utilisateur connecté à lire les parties (au moins id, join_code, initial_cash)
-- pour pouvoir résoudre la partie par code et rejoindre. Pas d'API de liste des parties,
-- donc en pratique on ne peut trouver une partie qu'en connaissant le code.

drop policy if exists "games_select_member" on public.games;

-- Lecture possible si : déjà membre OU utilisateur connecté (pour lookup par join_code)
create policy "games_select_member"
  on public.games for select
  using (
    exists (
      select 1 from public.game_players gp
      where gp.game_id = games.id and gp.user_id = auth.uid()
    )
  );

create policy "games_select_authenticated_join"
  on public.games for select
  using (auth.uid() is not null);
