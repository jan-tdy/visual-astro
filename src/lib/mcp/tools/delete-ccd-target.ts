import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "delete_ccd_target",
  title: "Delete POZOR CCD target",
  description: "Remove a CCD/photometry target from a POZOR catalog.",
  inputSchema: { target_id: z.string().uuid().describe("Target id to delete.") },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ target_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { error } = await supabase.from("ccd_targets").delete().eq("id", target_id);
    if (error) return fail(error.message);
    return ok({ deleted: target_id }, { deleted: target_id });
  },
});