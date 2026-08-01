import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";
import { isPlusActive, plusRequired } from "../subscription";

export default defineTool({
  name: "update_ccd_target",
  title: "Update POZOR CCD target",
  description: "Edit a CCD/photometry target's coordinates, ephemeris, filters or notes.",
  inputSchema: {
    target_id: z.string().uuid().describe("Target id."),
    name: z.string().trim().min(1).max(120).optional().describe("Target name."),
    constellation: z.string().trim().max(20).optional().describe("Constellation code."),
    ra_hours: z.number().min(0).max(24).optional().describe("J2000 right ascension in hours."),
    dec_deg: z.number().min(-90).max(90).optional().describe("J2000 declination in degrees."),
    epoch_jd: z.number().nullable().optional().describe("Epoch of primary minimum (JD)."),
    period_days: z.number().positive().nullable().optional().describe("Period in days."),
    filters: z.string().trim().nullable().optional().describe("Filters used."),
    notes: z.string().trim().nullable().optional().describe("Notes."),
    sort_order: z.number().int().min(0).optional().describe("Position within the catalog."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ target_id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    if (!(await isPlusActive(ctx))) return plusRequired();
    const fields = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(fields).length === 0) return fail("Nothing to update.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("ccd_targets")
      .update(fields)
      .eq("id", target_id)
      .select("id,catalog_id,name,constellation,ra_hours,dec_deg,epoch_jd,period_days,filters,notes,sort_order")
      .maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Target not found.");
    return ok(data, { target: data });
  },
});