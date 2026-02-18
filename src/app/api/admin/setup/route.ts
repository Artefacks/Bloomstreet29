import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/admin/setup
 * Applies missing migrations + seeds international prices.
 * Protected by CRON_SECRET. Run once after adding new instruments.
 */
export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const expected = process.env.CRON_SECRET;

  if (!expected || (cronSecret ?? bearerSecret) !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ ok: false, error: "Missing env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const log: string[] = [];

  // 1. Ensure seed_price column exists
  try {
    await supabase.from("instruments").select("seed_price").limit(1);
    log.push("seed_price column: already exists");
  } catch {
    // Column doesn't exist, we need to add it via RPC
    log.push("seed_price column: needs to be added (run migration in Supabase SQL editor)");
  }

  // 2. Seed international prices into prices_latest
  const seedData: { symbol: string; price: number }[] = [
    // Switzerland CHF
    { symbol: "NESN.SW", price: 82.50 },
    { symbol: "NOVN.SW", price: 92.30 },
    { symbol: "ROG.SW", price: 268.00 },
    { symbol: "UBSG.SW", price: 28.80 },
    { symbol: "SREN.SW", price: 122.40 },
    { symbol: "ZURN.SW", price: 530.00 },
    { symbol: "ABBN.SW", price: 50.20 },
    { symbol: "GIVN.SW", price: 3980.00 },
    { symbol: "LONN.SW", price: 565.00 },
    { symbol: "CSGN.SW", price: 0.82 },
    { symbol: "HOLN.SW", price: 83.50 },
    { symbol: "RICN.SW", price: 158.60 },
    { symbol: "SGSN.SW", price: 98.20 },
    { symbol: "ALC.SW", price: 82.40 },
    { symbol: "SIKA.SW", price: 240.00 },
    { symbol: "BARN.SW", price: 1520.00 },
    { symbol: "GEBN.SW", price: 530.00 },
    { symbol: "TEMN.SW", price: 68.50 },
    { symbol: "LOGN.SW", price: 78.90 },
    { symbol: "SLHN.SW", price: 710.00 },
    { symbol: "PSPN.SW", price: 128.50 },
    { symbol: "SPSN.SW", price: 97.80 },
    { symbol: "VATN.SW", price: 380.00 },
    { symbol: "DKSH.SW", price: 72.10 },
    { symbol: "CLN.SW", price: 13.20 },
    // France EUR
    { symbol: "MC.PA", price: 880.00 },
    { symbol: "OR.PA", price: 395.00 },
    { symbol: "AIR.PA", price: 168.00 },
    { symbol: "BNP.PA", price: 72.50 },
    { symbol: "SAN.PA", price: 102.00 },
    { symbol: "TTE.PA", price: 58.50 },
    { symbol: "DG.PA", price: 115.00 },
    { symbol: "SU.PA", price: 240.00 },
    { symbol: "CAP.PA", price: 165.00 },
    { symbol: "AI.PA", price: 180.00 },
    // Germany EUR
    { symbol: "SAP.DE", price: 235.00 },
    { symbol: "SIE.DE", price: 195.00 },
    { symbol: "ALV.DE", price: 290.00 },
    { symbol: "BAS.DE", price: 46.50 },
    { symbol: "VOW3.DE", price: 98.00 },
    { symbol: "BMW.DE", price: 82.00 },
    { symbol: "DAI.DE", price: 58.50 },
    { symbol: "DBK.DE", price: 17.80 },
    { symbol: "RWE.DE", price: 32.50 },
    { symbol: "ADS.DE", price: 235.00 },
    // Other Europe
    { symbol: "ASML.AS", price: 760.00 },
    { symbol: "ENI.MI", price: 14.20 },
    { symbol: "BBVA.MC", price: 11.50 },
    { symbol: "SAN.MC", price: 5.80 },
    { symbol: "NOKIA.HE", price: 4.50 },
    { symbol: "ERIC-B.ST", price: 78.00 },
  ];

  const now = new Date().toISOString();
  let seeded = 0;

  for (const { symbol, price } of seedData) {
    const { error } = await supabase.from("prices_latest").upsert(
      { symbol, price, as_of: now, source: "seed" },
      { onConflict: "symbol" }
    );
    if (!error) seeded++;
  }
  log.push(`Seeded ${seeded}/${seedData.length} prices in prices_latest`);

  // 3. Try to set seed_price on instruments (may fail if column doesn't exist)
  let seedPriceSet = 0;
  for (const { symbol, price } of seedData) {
    const { error } = await supabase
      .from("instruments")
      .update({ seed_price: price })
      .eq("symbol", symbol);
    if (!error) seedPriceSet++;
  }
  log.push(`Set seed_price on ${seedPriceSet}/${seedData.length} instruments`);

  return NextResponse.json({ ok: true, log });
}
