import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";
import { computeMagnitude } from "@/lib/astro";

export default defineTool({
  name: "add_observation",
  title: "Add observation",
  description:
    "Add an observation row to a session. Identify the star either by id or by catalog name; comparison values A/B accept magnitudes or comparator letters.",
  inputSchema: {
    session_id: z.string().uuid().describe("Session the observation belongs to."),
    star_id: z.string().uuid().optional().describe("Catalog star id."),
    star_name: z.string().trim().min(1).optional().describe("Catalog star name (used when star_id is omitted)."),
    a: z.string().trim().optional().describe("Brighter comparison star (magnitude or comparator letter)."),
    b: z.string().trim().optional().describe("Fainter comparison star (magnitude or comparator letter)."),
    pasos_a: z.number().int().min(0).max(99).optional().describe("Argelander steps to A."),
    pasos_b: z.number().int().min(0).max(99).optional().describe("Argelander steps to B."),
    limit_value: z.string().trim().optional().describe("Fainter-than limit, e.g. '<14.2'."),
    ut_time: z.string().trim().optional().describe("UT time as HH:MM."),
    note: z.string().trim().max(500).optional().describe("Row note, e.g. OUTBURST."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ session_id, star_id, star_name, ...row }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let starId = star_id ?? null;
    let resolvedName = star_name ?? null;
    if (!starId) {
      if (!star_name) return fail("Provide star_id or star_name.");
      const { data: matches, error } = await supabase
        .from("stars")
        .select("id,name")
        .ilike("name", star_name)
        .limit(5);
      if (error) return fail(error.message);
      if (!matches || matches.length === 0) return fail(`Star '${star_name}' not found in the catalog.`);
      if (matches.length > 1) return fail(`Ambiguous star name: ${matches.map((m) => m.name).join(", ")}`);
      starId = matches[0].id;
      resolvedName = matches[0].name;
    }
    const { data: last } = await supabase
      .from("observations")
      .select("row_index")
      .eq("session_id", session_id)
      .order("row_index", { ascending: false })
      .limit(1);
    const rowIndex = (last?.[0]?.row_index ?? -1) + 1;
    const { data, error } = await supabase
      .from("observations")
      .insert({
        session_id,
        star_id: starId,
        user_id: ctx.getUserId(),
        row_index: rowIndex,
        a: row.a ?? null,
        b: row.b ?? null,
        pasos_a: row.pasos_a ?? null,
        pasos_b: row.pasos_b ?? null,
        limit_value: row.limit_value ?? null,
        ut_time: row.ut_time ?? null,
        note: row.note ?? null,
      })
      .select("id,session_id,star_id,row_index,a,b,pasos_a,pasos_b,limit_value,ut_time,note")
      .single();
    if (error) return fail(error.message);
    const magnitude = computeMagnitude(data, resolvedName ?? undefined).value;
    return ok({ ...data, magnitude }, { observation: { ...data, magnitude } });
  },
});