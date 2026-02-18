-- Ajouter un nom affichable pour chaque joueur dans une partie (classement plus lisible).
-- Renseigné à la création de la partie ou au join (depuis user_metadata / email).

alter table public.game_players
  add column if not exists display_name text;

comment on column public.game_players.display_name is 'Nom affiché (ex. Google full_name ou email), renseigné à l''insertion.';
