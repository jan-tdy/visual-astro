import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";
import { computeMagnitude } from "../../astro";

export default defineTool({
  name: "get_session",
  title: "Get session with observations",
  description:
    "Read one observing session together with all of its observations, including the computed Argelander magnitude for each row.",
  inputSchema: { session_id: z.string().uuid().describe("Session id.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: session, error } = await supabase
      .from("sessions")
      .select("id,name,observed_at_utc,jd,notes,is_favorite")
      .eq("id", session_id)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!session) return fail("Session not found.");
    const { data: obs, error: obsErr } = await supabase
      .from("observations")
      .select("id,row_index,ut_time,a,b,pasos_a,pasos_b,limit_value,note,star_id,stars(name,constellation,vsnet_code,aavso_code,chart_id)")
      .eq("session_id", session_id)
      .order("row_index");
    if (obsErr) return fail(obsErr.message);
    const observations = (obs ?? []).map((o) => {
      const star = (o as { stars?: { name?: string } }).stars;
      return { ...o, magnitude: computeMagnitude(o, star?.name).value };
    });
    return ok({ session, observations }, { session, observations });
  },
});