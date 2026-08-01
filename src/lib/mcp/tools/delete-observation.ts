import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "delete_observation",
  title: "Delete observation",
  description: "Delete a single observation row from a session.",
  inputSchema: { observation_id: z.string().uuid().describe("Observation id to delete.") },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ observation_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { error } = await supabase.from("observations").delete().eq("id", observation_id);
    if (error) return fail(error.message);
    return ok({ deleted: observation_id }, { deleted: observation_id });
  },
});