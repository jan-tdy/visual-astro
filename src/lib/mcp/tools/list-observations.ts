import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_observations",
  title: "List observations",
  description:
    "List observations for one session (or the most recent ones across all sessions) with star name, comparison stars, steps, limit and UT time.",
  inputSchema: {
    session_id: z.string().uuid().optional().describe("Session id to read; omit to read the latest observations."),
    limit: z.number().int().min(1).max(500).default(100).describe("Maximum number of observations to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("observations")
      .select("id,session_id,row_index,ut_time,a,b,pasos_a,pasos_b,limit_value,note,stars(name,constellation)")
      .order("created_at", { ascending: false })
      .limit(limit ?? 100);
    if (session_id) query = query.eq("session_id", session_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { observations: data ?? [] },
    };
  },
});