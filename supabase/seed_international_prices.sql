-- ============================================
-- BLOOMSTREET29 – SEED REALISTIC PRICES FOR INTERNATIONAL STOCKS
-- Run once to initialize. Simulation takes over after this.
-- Prices are approximate Feb 2026 values in local currency.
-- Also sets seed_price on instruments for mean-reversion anchor.
-- ============================================

-- 1. Seed prices_latest
INSERT INTO public.prices_latest (symbol, price, as_of, source) VALUES
-- 🇨🇭 SWITZERLAND (CHF)
('NESN.SW',   82.50, now(), 'seed'),
('NOVN.SW',   92.30, now(), 'seed'),
('ROG.SW',   268.00, now(), 'seed'),
('UBSG.SW',   28.80, now(), 'seed'),
('SREN.SW',  122.40, now(), 'seed'),
('ZURN.SW',  530.00, now(), 'seed'),
('ABBN.SW',   50.20, now(), 'seed'),
('GIVN.SW', 3980.00, now(), 'seed'),
('LONN.SW',  565.00, now(), 'seed'),
('CSGN.SW',    0.82, now(), 'seed'),
('HOLN.SW',   83.50, now(), 'seed'),
('RICN.SW',  158.60, now(), 'seed'),
('SGSN.SW',   98.20, now(), 'seed'),
('ALC.SW',    82.40, now(), 'seed'),
('SIKA.SW',  240.00, now(), 'seed'),
('BARN.SW', 1520.00, now(), 'seed'),
('GEBN.SW',  530.00, now(), 'seed'),
('TEMN.SW',   68.50, now(), 'seed'),
('LOGN.SW',   78.90, now(), 'seed'),
('SLHN.SW',  710.00, now(), 'seed'),
('PSPN.SW',  128.50, now(), 'seed'),
('SPSN.SW',   97.80, now(), 'seed'),
('VATN.SW',  380.00, now(), 'seed'),
('DKSH.SW',   72.10, now(), 'seed'),
('CLN.SW',    13.20, now(), 'seed'),
-- 🇫🇷 FRANCE (EUR)
('MC.PA',    880.00, now(), 'seed'),
('OR.PA',    395.00, now(), 'seed'),
('AIR.PA',   168.00, now(), 'seed'),
('BNP.PA',    72.50, now(), 'seed'),
('SAN.PA',   102.00, now(), 'seed'),
('TTE.PA',    58.50, now(), 'seed'),
('DG.PA',    115.00, now(), 'seed'),
('SU.PA',    240.00, now(), 'seed'),
('CAP.PA',   165.00, now(), 'seed'),
('AI.PA',    180.00, now(), 'seed'),
-- 🇩🇪 GERMANY (EUR)
('SAP.DE',   235.00, now(), 'seed'),
('SIE.DE',   195.00, now(), 'seed'),
('ALV.DE',   290.00, now(), 'seed'),
('BAS.DE',    46.50, now(), 'seed'),
('VOW3.DE',   98.00, now(), 'seed'),
('BMW.DE',    82.00, now(), 'seed'),
('DAI.DE',    58.50, now(), 'seed'),
('DBK.DE',    17.80, now(), 'seed'),
('RWE.DE',    32.50, now(), 'seed'),
('ADS.DE',   235.00, now(), 'seed'),
-- 🌍 OTHER EUROPE
('ASML.AS',  760.00, now(), 'seed'),
('ENI.MI',    14.20, now(), 'seed'),
('BBVA.MC',   11.50, now(), 'seed'),
('SAN.MC',     5.80, now(), 'seed'),
('NOKIA.HE',   4.50, now(), 'seed'),
('ERIC-B.ST',  78.00, now(), 'seed')
ON CONFLICT (symbol) DO UPDATE SET price = EXCLUDED.price, as_of = EXCLUDED.as_of, source = EXCLUDED.source;

-- 2. Set seed_price on instruments (anchor for simulation mean-reversion)
UPDATE public.instruments SET seed_price =  82.50 WHERE symbol = 'NESN.SW';
UPDATE public.instruments SET seed_price =  92.30 WHERE symbol = 'NOVN.SW';
UPDATE public.instruments SET seed_price = 268.00 WHERE symbol = 'ROG.SW';
UPDATE public.instruments SET seed_price =  28.80 WHERE symbol = 'UBSG.SW';
UPDATE public.instruments SET seed_price = 122.40 WHERE symbol = 'SREN.SW';
UPDATE public.instruments SET seed_price = 530.00 WHERE symbol = 'ZURN.SW';
UPDATE public.instruments SET seed_price =  50.20 WHERE symbol = 'ABBN.SW';
UPDATE public.instruments SET seed_price =3980.00 WHERE symbol = 'GIVN.SW';
UPDATE public.instruments SET seed_price = 565.00 WHERE symbol = 'LONN.SW';
UPDATE public.instruments SET seed_price =   0.82 WHERE symbol = 'CSGN.SW';
UPDATE public.instruments SET seed_price =  83.50 WHERE symbol = 'HOLN.SW';
UPDATE public.instruments SET seed_price = 158.60 WHERE symbol = 'RICN.SW';
UPDATE public.instruments SET seed_price =  98.20 WHERE symbol = 'SGSN.SW';
UPDATE public.instruments SET seed_price =  82.40 WHERE symbol = 'ALC.SW';
UPDATE public.instruments SET seed_price = 240.00 WHERE symbol = 'SIKA.SW';
UPDATE public.instruments SET seed_price =1520.00 WHERE symbol = 'BARN.SW';
UPDATE public.instruments SET seed_price = 530.00 WHERE symbol = 'GEBN.SW';
UPDATE public.instruments SET seed_price =  68.50 WHERE symbol = 'TEMN.SW';
UPDATE public.instruments SET seed_price =  78.90 WHERE symbol = 'LOGN.SW';
UPDATE public.instruments SET seed_price = 710.00 WHERE symbol = 'SLHN.SW';
UPDATE public.instruments SET seed_price = 128.50 WHERE symbol = 'PSPN.SW';
UPDATE public.instruments SET seed_price =  97.80 WHERE symbol = 'SPSN.SW';
UPDATE public.instruments SET seed_price = 380.00 WHERE symbol = 'VATN.SW';
UPDATE public.instruments SET seed_price =  72.10 WHERE symbol = 'DKSH.SW';
UPDATE public.instruments SET seed_price =  13.20 WHERE symbol = 'CLN.SW';
UPDATE public.instruments SET seed_price = 880.00 WHERE symbol = 'MC.PA';
UPDATE public.instruments SET seed_price = 395.00 WHERE symbol = 'OR.PA';
UPDATE public.instruments SET seed_price = 168.00 WHERE symbol = 'AIR.PA';
UPDATE public.instruments SET seed_price =  72.50 WHERE symbol = 'BNP.PA';
UPDATE public.instruments SET seed_price = 102.00 WHERE symbol = 'SAN.PA';
UPDATE public.instruments SET seed_price =  58.50 WHERE symbol = 'TTE.PA';
UPDATE public.instruments SET seed_price = 115.00 WHERE symbol = 'DG.PA';
UPDATE public.instruments SET seed_price = 240.00 WHERE symbol = 'SU.PA';
UPDATE public.instruments SET seed_price = 165.00 WHERE symbol = 'CAP.PA';
UPDATE public.instruments SET seed_price = 180.00 WHERE symbol = 'AI.PA';
UPDATE public.instruments SET seed_price = 235.00 WHERE symbol = 'SAP.DE';
UPDATE public.instruments SET seed_price = 195.00 WHERE symbol = 'SIE.DE';
UPDATE public.instruments SET seed_price = 290.00 WHERE symbol = 'ALV.DE';
UPDATE public.instruments SET seed_price =  46.50 WHERE symbol = 'BAS.DE';
UPDATE public.instruments SET seed_price =  98.00 WHERE symbol = 'VOW3.DE';
UPDATE public.instruments SET seed_price =  82.00 WHERE symbol = 'BMW.DE';
UPDATE public.instruments SET seed_price =  58.50 WHERE symbol = 'DAI.DE';
UPDATE public.instruments SET seed_price =  17.80 WHERE symbol = 'DBK.DE';
UPDATE public.instruments SET seed_price =  32.50 WHERE symbol = 'RWE.DE';
UPDATE public.instruments SET seed_price = 235.00 WHERE symbol = 'ADS.DE';
UPDATE public.instruments SET seed_price = 760.00 WHERE symbol = 'ASML.AS';
UPDATE public.instruments SET seed_price =  14.20 WHERE symbol = 'ENI.MI';
UPDATE public.instruments SET seed_price =  11.50 WHERE symbol = 'BBVA.MC';
UPDATE public.instruments SET seed_price =   5.80 WHERE symbol = 'SAN.MC';
UPDATE public.instruments SET seed_price =   4.50 WHERE symbol = 'NOKIA.HE';
UPDATE public.instruments SET seed_price =  78.00 WHERE symbol = 'ERIC-B.ST';
