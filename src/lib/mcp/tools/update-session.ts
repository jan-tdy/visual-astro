import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "update_session",
  title: "Update observing session",
  description: "Rename an observing session or change its notes, UTC date/time or favourite flag.",
  inputSchema: {
    session_id: z.string().uuid().describe("Session id."),
    name: z.string().trim().max(200).optional().describe("New session name."),
    notes: z.string().trim().max(2000).optional().describe("New session notes."),
    observed_at_utc: z.string().trim().optional().describe("New observation date/time in UTC ISO format."),
    is_favorite: z.boolean().optional().describe("Mark or unmark as favourite."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ session_id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(fields).length === 0) return fail("Nothing to update.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sessions")
      .update(fields)
      .eq("id", session_id)
      .select("id,name,observed_at_utc,jd,notes,is_favorite")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Session not found.");
    return ok(data, { session: data });
  },
});