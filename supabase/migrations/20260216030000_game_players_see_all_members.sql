-- Fix: Permettre à tous les membres d'une partie de voir les autres joueurs (pour le classement).
--
-- Problème: La politique actuelle ne permet de voir que sa propre ligne (ou toutes si créateur).
-- Un joueur qui a rejoint ne voit pas les autres → le classement n'affiche qu'une seule entrée.
--
-- Solution: Fonction security definer qui retourne les game_id où auth.uid() est membre.
-- Politique: on peut lire une ligne de game_players si game_id est dans ce set.
-- Pas de récursion car la fonction lit game_players avec les droits du propriétaire (bypass RLS).

create or replace function public.get_my_game_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select game_id from public.game_players where user_id = auth.uid();
$$;

-- Remplacer la politique pour que tout membre d'une partie voie tous les joueurs de cette partie
drop policy if exists "game_players_select_member" on public.game_players;

create policy "game_players_select_member"
  on public.game_players for select
  using (
    game_id in (select public.get_my_game_ids())
  );
