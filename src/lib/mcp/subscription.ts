import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";
import { fail } from "./helpers";

const DEV_PLUS_EMAIL = "var@kozmos.sk";

/** Mirrors useSubscription()'s isPlusActive logic (subscriptions row, active bonus, dev override). */
export async function isPlusActive(ctx: ToolContext): Promise<boolean> {
  const client = supabaseForUser(ctx);

  const { data: sub } = await client
    .from("subscriptions")
    .select("status,current_period_end")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const status = (sub as { status?: string; current_period_end?: string | null } | null) ?? null;
  const realPlusActive =
    !!status &&
    (((["active", "trialing", "past_due"].includes(status.status ?? "")) &&
      (!status.current_period_end || new Date(status.current_period_end) > new Date())) ||
      (status.status === "canceled" &&
        !!status.current_period_end &&
        new Date(status.current_period_end) > new Date()));
  if (realPlusActive) return true;

  const { data: bonus } = await client
    .from("plus_bonuses")
    .select("expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bonus) return true;

  if (ctx.getUserEmail()?.toLowerCase() === DEV_PLUS_EMAIL) {
    const { data: profile } = await client
      .from("profiles")
      .select("dev_plus_override")
      .maybeSingle();
    if ((profile as { dev_plus_override?: boolean } | null)?.dev_plus_override) return true;
  }
  return false;
}

export function plusRequired() {
  return fail("This POZOR tool requires a Plus subscription. Upgrade in the app under Settings → Plán & fakturácia.");
}
