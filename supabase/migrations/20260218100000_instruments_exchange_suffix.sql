-- Chaque instrument est lié à un marché (bourse) avec des horaires spécifiques.
-- exchange_suffix: "" = US, ".SW" = Suisse, ".PA" = Paris, etc.
-- Si null, on infère depuis le symbole (comportement actuel).

ALTER TABLE public.instruments
  ADD COLUMN IF NOT EXISTS exchange_suffix text;

COMMENT ON COLUMN public.instruments.exchange_suffix IS 'Suffixe de la bourse ("" US, ".SW" Suisse, ".PA" Paris...). Détermine les horaires de cotation. Si null, inféré depuis symbol.';

-- Remplir depuis le symbole pour les instruments existants
UPDATE public.instruments SET exchange_suffix = 
  CASE 
    WHEN symbol LIKE '%.SW' THEN '.SW'
    WHEN symbol LIKE '%.PA' THEN '.PA'
    WHEN symbol LIKE '%.DE' THEN '.DE'
    WHEN symbol LIKE '%.AS' THEN '.AS'
    WHEN symbol LIKE '%.MI' THEN '.MI'
    WHEN symbol LIKE '%.MC' THEN '.MC'
    WHEN symbol LIKE '%.HE' THEN '.HE'
    WHEN symbol LIKE '%.ST' THEN '.ST'
    ELSE ''
  END
WHERE exchange_suffix IS NULL;
