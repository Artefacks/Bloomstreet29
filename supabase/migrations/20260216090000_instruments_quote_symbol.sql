-- Symbole utilisé pour récupérer le cours (Finnhub Quote).
-- Résolu une fois via Finnhub Symbol Search, puis réutilisé à chaque refresh.
-- Permet d'ajouter des instruments en masse (symbol + name) sans gérer les suffixes d'exchange à la main.

alter table public.instruments
  add column if not exists quote_symbol text;

comment on column public.instruments.quote_symbol is 'Symbole utilisé pour l''API Quote (ex. Finnhub), résolu via Symbol Search. Si null, on utilise symbol.';
