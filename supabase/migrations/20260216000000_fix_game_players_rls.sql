-- Fix: Corriger la politique RLS pour game_players qui cause une récursion infinie
-- 
-- Problème: La politique SELECT vérifiait l'existence dans game_players elle-même,
-- créant une récursion lors de l'insertion d'un nouveau joueur.
-- 
-- Solution SIMPLIFIÉE: Permettre la lecture si:
-- 1. L'utilisateur est propriétaire de la ligne (user_id = auth.uid()) - évite la récursion
-- 2. OU l'utilisateur a créé la partie (via games.created_by) - évite aussi la récursion
--
-- Cette version évite complètement la récursion car on ne vérifie jamais game_players
-- dans la politique SELECT. Les membres pourront voir les autres membres via
-- une politique séparée si nécessaire, ou via une fonction/vue.

-- Supprimer l'ancienne politique
drop policy if exists "game_players_select_member" on public.game_players;

-- Nouvelle politique simplifiée qui évite complètement la récursion
-- En permettant user_id = auth.uid() en premier, on évite la récursion lors de l'insertion
create policy "game_players_select_member"
  on public.game_players for select
  using (
    -- Cas 1: L'utilisateur peut toujours lire sa propre ligne (évite la récursion lors de l'insertion)
    user_id = auth.uid()
    OR
    -- Cas 2: L'utilisateur peut lire tous les joueurs s'il a créé la partie (pas de récursion)
    -- On vérifie via games.created_by au lieu de game_players pour éviter la récursion
    exists (
      select 1 from public.games g
      where g.id = game_players.game_id
        and g.created_by = auth.uid()
    )
  );
