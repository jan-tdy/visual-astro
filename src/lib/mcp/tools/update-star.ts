import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "update_star",
  title: "Update catalog star",
  description: "Edit a star in the visual catalog, including its display order inside the constellation.",
  inputSchema: {
    star_id: z.string().uuid().describe("Star id."),
    name: z.string().trim().min(1).max(120).optional().describe("Star name."),
    constellation: z.string().trim().min(1).max(20).optional().describe("Constellation code."),
    type: z.enum(["VISUAL", "BINAR", "ECL faint", "ECL bright"]).optional().describe("Star type."),
    vsnet_code: z.string().trim().nullable().optional().describe("VSNET code."),
    aavso_code: z.string().trim().nullable().optional().describe("AAVSO designation."),
    chart_id: z.string().trim().nullable().optional().describe("AAVSO chart id."),
    notes: z.string().trim().nullable().optional().describe("Notes."),
    sort_order: z.number().int().min(0).optional().describe("Position within the constellation."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ star_id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(fields).length === 0) return fail("Nothing to update.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("stars")
      .update(fields)
      .eq("id", star_id)
      .select("id,name,constellation,type,vsnet_code,aavso_code,chart_id,notes,sort_order")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Star not found.");
    return ok(data, { star: data });
  },
});