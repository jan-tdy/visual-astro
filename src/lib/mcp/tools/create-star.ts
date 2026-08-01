import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "create_star",
  title: "Add catalog star",
  description: "Add a star to the observer's visual catalog.",
  inputSchema: {
    name: z.string().trim().min(1).max(120).describe("Star name, e.g. 'SS Cyg'."),
    constellation: z.string().trim().min(1).max(20).describe("Constellation code, e.g. 'Cyg'."),
    type: z.enum(["VISUAL", "BINAR", "ECL faint", "ECL bright"]).default("VISUAL").describe("Star type."),
    vsnet_code: z.string().trim().max(20).optional().describe("VSNET code."),
    aavso_code: z.string().trim().max(20).optional().describe("AAVSO designation."),
    chart_id: z.string().trim().max(40).optional().describe("AAVSO chart id."),
    notes: z.string().trim().max(1000).optional().describe("Notes."),
    sort_order: z.number().int().min(0).optional().describe("Position within the constellation."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let sortOrder = input.sort_order;
    if (sortOrder === undefined) {
      const { data: last } = await supabase
        .from("stars")
        .select("sort_order")
        .eq("constellation", input.constellation)
        .order("sort_order", { ascending: false })
        .limit(1);
      sortOrder = (last?.[0]?.sort_order ?? -1) + 1;
    }
    const { data, error } = await supabase
      .from("stars")
      .insert({
        user_id: ctx.getUserId(),
        name: input.name,
        constellation: input.constellation,
        type: input.type ?? "VISUAL",
        vsnet_code: input.vsnet_code ?? null,
        aavso_code: input.aavso_code ?? null,
        chart_id: input.chart_id ?? null,
        notes: input.notes ?? null,
        sort_order: sortOrder,
      })
      .select("id,name,constellation,type,vsnet_code,aavso_code,chart_id,notes,sort_order")
      .single();
    if (error) return fail(error.message);
    return ok(data, { star: data });
  },
});