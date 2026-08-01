import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "delete_session",
  title: "Delete observing session",
  description: "Permanently delete an observing session and all observations that belong to it.",
  inputSchema: { session_id: z.string().uuid().describe("Session id to delete.") },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ session_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { error: obsErr } = await supabase.from("observations").delete().eq("session_id", session_id);
    if (obsErr) return fail(obsErr.message);
    const { error } = await supabase.from("sessions").delete().eq("id", session_id);
    if (error) return fail(error.message);
    return ok({ deleted: session_id }, { deleted: session_id });
  },
});