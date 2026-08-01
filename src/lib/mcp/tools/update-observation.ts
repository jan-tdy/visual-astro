import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";

export default defineTool({
  name: "update_observation",
  title: "Update observation",
  description: "Change the comparison stars, steps, limit, UT time or note of an existing observation row.",
  inputSchema: {
    observation_id: z.string().uuid().describe("Observation id."),
    a: z.string().trim().nullable().optional().describe("Brighter comparison star."),
    b: z.string().trim().nullable().optional().describe("Fainter comparison star."),
    pasos_a: z.number().int().min(0).max(99).nullable().optional().describe("Argelander steps to A."),
    pasos_b: z.number().int().min(0).max(99).nullable().optional().describe("Argelander steps to B."),
    limit_value: z.string().trim().nullable().optional().describe("Fainter-than limit."),
    ut_time: z.string().trim().nullable().optional().describe("UT time as HH:MM."),
    note: z.string().trim().max(500).nullable().optional().describe("Row note."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ observation_id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(fields).length === 0) return fail("Nothing to update.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("observations")
      .update(fields)
      .eq("id", observation_id)
      .select("id,session_id,star_id,row_index,a,b,pasos_a,pasos_b,limit_value,ut_time,note")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Observation not found.");
    return ok(data, { observation: data });
  },
});