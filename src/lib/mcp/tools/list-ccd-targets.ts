import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_ccd_targets",
  title: "List POZOR CCD targets",
  description: "List the observer's CCD/photometry targets with coordinates, epoch and period.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Case-insensitive target name search."),
    limit: z.number().int().min(1).max(500).default(200).describe("Maximum number of targets to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("ccd_targets")
      .select("id,name,constellation,ra_hours,dec_deg,epoch_jd,period_days,filters,notes,sort_order")
      .order("constellation")
      .order("sort_order")
      .limit(limit ?? 200);
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { targets: data ?? [] },
    };
  },
});