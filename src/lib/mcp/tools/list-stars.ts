import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_stars",
  title: "List catalog stars",
  description: "List the observer's visual star catalog, optionally filtered by constellation or a name search.",
  inputSchema: {
    constellation: z.string().trim().min(1).optional().describe("Filter by constellation code, e.g. 'Dra'."),
    search: z.string().trim().min(1).optional().describe("Case-insensitive star name search."),
    limit: z.number().int().min(1).max(500).default(200).describe("Maximum number of stars to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ constellation, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("stars")
      .select("id,name,constellation,type,aavso_code,vsnet_code,chart_id,notes,sort_order")
      .order("constellation")
      .order("sort_order")
      .limit(limit ?? 200);
    if (constellation) query = query.eq("constellation", constellation);
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { stars: data ?? [] },
    };
  },
});