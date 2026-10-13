import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "delete_star",
  title: "Delete catalog star",
  description: "Remove a star from the visual catalog. Fails if observations still reference it.",
  inputSchema: { star_id: z.string().uuid().describe("Star id to delete.") },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ star_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("stars").delete().eq("id", star_id).select("id");
    if (error) return fail(error.message);
    if (!data || data.length === 0) return fail("Star not found (or not yours to delete).");
    return ok({ deleted: star_id }, { deleted: star_id });
  },
});