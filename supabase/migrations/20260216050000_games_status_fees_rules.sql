-- Statut de partie basé sur le temps + frais / règles de marché

-- Games: started_at, ends_at, status, frais et règles
alter table public.games
  add column if not exists started_at timestamptz default now(),
  add column if not exists ends_at timestamptz,
  add column if not exists status text default 'active' check (status in ('pending','active','finished')),
  add column if not exists fee_bps int not null default 10,
  add column if not exists allow_fractional boolean not null default true,
  add column if not exists min_order_amount numeric(18,2) not null default 0;

comment on column public.games.fee_bps is 'Frais par trade en basis points (10 = 0,1%)';
comment on column public.games.allow_fractional is 'Autoriser les quantités fractionnaires';
comment on column public.games.min_order_amount is 'Montant minimum par ordre (0 = pas de minimum)';

-- Remplir ends_at pour les parties existantes: created_at + duration_days
update public.games
set started_at = coalesce(started_at, created_at),
    ends_at = coalesce(ends_at, created_at + (duration_days || ' days')::interval)
where ends_at is null;

-- Nouvelle partie: ends_at doit être renseigné à la création (voir API create)

-- Ordres: frais enregistrés
alter table public.orders
  add column if not exists fee_amount numeric(18,4) not null default 0;
