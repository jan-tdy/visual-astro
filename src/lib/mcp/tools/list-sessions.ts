import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_sessions",
  title: "List observing sessions",
  description: "List the signed-in observer's visual observing sessions, newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum number of sessions to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sessions")
      .select("id,name,observed_at_utc,jd,notes,is_favorite")
      .order("observed_at_utc", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { sessions: data ?? [] },
    };
  },
});