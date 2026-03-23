-- Blitz educational pass:
-- label assets by class so players can build a strategy (Tech / Energy / Bonds)

UPDATE public.instruments
SET name = CASE symbol
  WHEN 'BTC.BLITZ' THEN 'Tech Core - BTC'
  WHEN 'ETH.BLITZ' THEN 'Tech Core - ETH'
  WHEN 'DOGE.BLITZ' THEN 'Tech Beta - DOGE'
  WHEN 'MEME.BLITZ' THEN 'Tech Beta - MEME'
  WHEN 'MOON.BLITZ' THEN 'Tech Momentum - MOON'
  WHEN 'PEPE.BLITZ' THEN 'Tech Momentum - PEPE'
  WHEN 'SHIB.BLITZ' THEN 'Tech Momentum - SHIB'
  WHEN 'YOLO.BLITZ' THEN 'Tech Growth - YOLO'
  WHEN 'NINJA.BLITZ' THEN 'Tech Signals - NINJA'
  WHEN 'UNICORN.BLITZ' THEN 'Tech Innovation - UNICORN'

  WHEN 'WOOF.BLITZ' THEN 'Energy Grid - WOOF'
  WHEN 'ROCKET.BLITZ' THEN 'Energy Fuel - ROCKET'
  WHEN 'LAMBO.BLITZ' THEN 'Energy Transport - LAMBO'
  WHEN 'LASER.BLITZ' THEN 'Energy Industrial - LASER'
  WHEN 'TURBO.BLITZ' THEN 'Energy Momentum - TURBO'
  WHEN 'SPACE.BLITZ' THEN 'Energy Frontier - SPACE'

  WHEN 'DIAMOND.BLITZ' THEN 'Bonds Shield - DIAMOND'
  WHEN 'PIZZA.BLITZ' THEN 'Bonds Carry - PIZZA'
  WHEN 'ZOMBIE.BLITZ' THEN 'Bonds Defensive - ZOMBIE'
  WHEN 'CHAOS.BLITZ' THEN 'Bonds Hedge - CHAOS'
  ELSE name
END
WHERE symbol LIKE '%.BLITZ';
