-- ============================================
-- Bloomstreet — seed 02 : ~100 instruments (US + Europe)
-- Idempotent. Exécuter après 01 si vous partez de zéro, ou seul pour la prod type.
-- ============================================

insert into public.instruments (symbol, name)
values
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
('BRK.B', 'Berkshire Hathaway')
on conflict (symbol) do nothing;
