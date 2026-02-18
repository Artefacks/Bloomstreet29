-- ============================================
-- BLOOMSTREET29 – 100 INSTRUMENTS SEED
-- Suisse-focused
-- Idempotent (safe to run multiple times)
-- ============================================

insert into public.instruments (symbol, name)
values
-- =========================
-- 🇨🇭 SWITZERLAND (25)
-- =========================
('NESN.SW', 'Nestle'),
('NOVN.SW', 'Novartis'),
('ROG.SW', 'Roche'),
('UBSG.SW', 'UBS'),
('SREN.SW', 'Swiss Re'),
('ZURN.SW', 'Zurich Insurance'),
('ABBN.SW', 'ABB'),
('GIVN.SW', 'Givaudan'),
('LONN.SW', 'Lonza'),
('CSGN.SW', 'Credit Suisse'),
('HOLN.SW', 'Holcim'),
('RICN.SW', 'Richemont'),
('SGSN.SW', 'SGS'),
('ALC.SW', 'Alcon'),
('SIKA.SW', 'Sika'),
('BARN.SW', 'Barry Callebaut'),
('GEBN.SW', 'Geberit'),
('TEMN.SW', 'Temenos'),
('LOGN.SW', 'Logitech'),
('SLHN.SW', 'Swiss Life'),
('PSPN.SW', 'PSP Swiss Property'),
('SPSN.SW', 'Swiss Prime Site'),
('VATN.SW', 'VAT Group'),
('DKSH.SW', 'DKSH'),
('CLN.SW', 'Clariant'),

-- =========================
-- 🇺🇸 USA (45)
-- =========================
('NVDA', 'Nvidia'),
('TSLA', 'Tesla'),
('NFLX', 'Netflix'),
('GOOG', 'Alphabet Class C'),
('AMD', 'AMD'),
('INTC', 'Intel'),
('CRM', 'Salesforce'),
('ORCL', 'Oracle'),
('ADBE', 'Adobe'),
('AVGO', 'Broadcom'),
('QCOM', 'Qualcomm'),
('PYPL', 'PayPal'),
('UBER', 'Uber'),
('SNOW', 'Snowflake'),
('PLTR', 'Palantir'),
('JPM', 'JPMorgan'),
('GS', 'Goldman Sachs'),
('BAC', 'Bank of America'),
('MS', 'Morgan Stanley'),
('V', 'Visa'),
('MA', 'Mastercard'),
('JNJ', 'Johnson & Johnson'),
('PFE', 'Pfizer'),
('MRK', 'Merck'),
('UNH', 'UnitedHealth'),
('LLY', 'Eli Lilly'),
('KO', 'Coca-Cola'),
('PEP', 'PepsiCo'),
('MCD', 'McDonalds'),
('SBUX', 'Starbucks'),
('NKE', 'Nike'),
('DIS', 'Disney'),
('WMT', 'Walmart'),
('COST', 'Costco'),
('HD', 'Home Depot'),
('LOW', 'Lowes'),
('BA', 'Boeing'),
('CAT', 'Caterpillar'),
('GE', 'General Electric'),
('XOM', 'Exxon Mobil'),
('CVX', 'Chevron'),
('SLB', 'Schlumberger'),
('F', 'Ford'),
('GM', 'General Motors'),
('BRK.B', 'Berkshire Hathaway'),

-- =========================
-- 🇫🇷 FRANCE (10)
-- =========================
('MC.PA', 'LVMH'),
('OR.PA', 'Loreal'),
('AIR.PA', 'Airbus'),
('BNP.PA', 'BNP Paribas'),
('SAN.PA', 'Sanofi'),
('TTE.PA', 'TotalEnergies'),
('DG.PA', 'Vinci'),
('SU.PA', 'Schneider Electric'),
('CAP.PA', 'Capgemini'),
('AI.PA', 'Air Liquide'),

-- =========================
-- 🇩🇪 GERMANY (10)
-- =========================
('SAP.DE', 'SAP'),
('SIE.DE', 'Siemens'),
('ALV.DE', 'Allianz'),
('BAS.DE', 'BASF'),
('VOW3.DE', 'Volkswagen'),
('BMW.DE', 'BMW'),
('DAI.DE', 'Mercedes-Benz'),
('DBK.DE', 'Deutsche Bank'),
('RWE.DE', 'RWE'),
('ADS.DE', 'Adidas'),

-- =========================
-- 🌍 EUROPE / GLOBAL (10)
-- =========================
('ASML.AS', 'ASML'),
('RACE', 'Ferrari'),
('ENI.MI', 'ENI'),
('BBVA.MC', 'BBVA'),
('SAN.MC', 'Santander'),
('NOKIA.HE', 'Nokia'),
('ERIC-B.ST', 'Ericsson'),
('HSBC', 'HSBC'),
('BHP', 'BHP Group'),
('TSM', 'Taiwan Semiconductor')
on conflict (symbol) do nothing;
