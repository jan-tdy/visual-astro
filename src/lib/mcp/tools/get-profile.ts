import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "get_profile",
  title: "Get observer profile",
  description:
    "Read the signed-in observer's profile: observer code, reference date, export portal preferences, plan status and counts of sessions, stars and CCD targets.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("obs_code,fecha_referencia,open_portal_after_export,portal_urls")
      .maybeSingle();
    if (error) return fail(error.message);
    const counts = await Promise.all(
      (["sessions", "observations", "stars", "ccd_targets"] as const).map(async (table) => {
        const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
        return [table, count ?? 0] as const;
      }),
    );
    const payload = {
      user_id: ctx.getUserId(),
      email: ctx.getUserEmail(),
      profile: profile ?? null,
      counts: Object.fromEntries(counts),
    };
    return ok(payload, payload as unknown as Record<string, unknown>);
  },
});