import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "list_ccd_catalogs",
  title: "List POZOR catalogs",
  description: "List the observer's POZOR CCD target catalogs (groups of targets).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("ccd_catalogs")
      .select("id,name,sort_order,created_at")
      .order("sort_order");
    if (error) return fail(error.message);
    return ok(data ?? [], { catalogs: data ?? [] });
  },
});