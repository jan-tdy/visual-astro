import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "update_profile",
  title: "Update observer profile",
  description: "Change the observer code or reference date used by exports.",
  inputSchema: {
    obs_code: z.string().trim().min(1).max(10).optional().describe("Observer code, e.g. 'DPV'."),
    fecha_referencia: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Reference date, YYYY-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (patch, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(fields).length === 0) return fail("Nothing to update.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .update(fields)
      .eq("user_id", ctx.getUserId())
      .select("obs_code,fecha_referencia")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Profile not found.");
    return ok(data, { profile: data });
  },
});