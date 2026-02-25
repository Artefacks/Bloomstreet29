import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { matchPendingOrders } from "@/lib/order-matching";

/**
 * POST /api/orders/match
 * Exécute le matching des ordres limite en attente.
 * Appelé par cron toutes les 1–5 min (sans refresh des prix Finnhub).
 * Les prix sont déjà à jour via refresh-public ou le cron quotidien.
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

  try {
    const filled = await matchPendingOrders(supabase);
    return NextResponse.json({ ok: true, filled });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[orders/match]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
