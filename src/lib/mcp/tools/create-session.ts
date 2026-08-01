import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "create_session",
  title: "Create observing session",
  description: "Create a new visual observing session for the signed-in observer.",
  inputSchema: {
    name: z.string().trim().min(1).max(200).optional().describe("Session name."),
    observed_at_utc: z
      .string()
      .trim()
      .optional()
      .describe("Observation date/time in UTC ISO format; defaults to now."),
    notes: z.string().trim().max(2000).optional().describe("Free-form session notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name, observed_at_utc, notes }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: ctx.getUserId()!,
        name: name ?? null,
        notes: notes ?? null,
        ...(observed_at_utc ? { observed_at_utc } : {}),
      })
      .select("id,name,observed_at_utc,notes")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { session: data },
    };
  },
});