import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";
import { ok, fail } from "../helpers";
import { isPlusActive, plusRequired } from "../subscription";

export default defineTool({
  name: "create_ccd_target",
  title: "Add POZOR CCD target",
  description:
    "Add a CCD/photometry target to a POZOR catalog. Coordinates are J2000 (RA in hours, Dec in degrees).",
  inputSchema: {
    name: z.string().trim().min(1).max(120).describe("Target name."),
    ra_hours: z.number().min(0).max(24).describe("J2000 right ascension in hours."),
    dec_deg: z.number().min(-90).max(90).describe("J2000 declination in degrees."),
    constellation: z.string().trim().max(20).optional().describe("Constellation code."),
    catalog_id: z.string().uuid().optional().describe("Target catalog id; defaults to the first catalog."),
    catalog_name: z.string().trim().min(1).max(120).optional().describe("Catalog name; created if it does not exist."),
    epoch_jd: z.number().optional().describe("Epoch of primary minimum (JD)."),
    period_days: z.number().positive().optional().describe("Orbital/pulsation period in days."),
    filters: z.string().trim().max(60).optional().describe("Filters used, e.g. 'V, R'."),
    notes: z.string().trim().max(1000).optional().describe("Notes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    if (!(await isPlusActive(ctx))) return plusRequired();
    const supabase = supabaseForUser(ctx);
    let catalogId = input.catalog_id ?? null;
    if (!catalogId) {
      const { data: cats, error: catErr } = await supabase
        .from("ccd_catalogs")
        .select("id,name")
        .order("sort_order");
      if (catErr) return fail(catErr.message);
      const wanted = input.catalog_name?.trim().toLowerCase();
      const found = wanted ? cats?.find((c) => c.name.toLowerCase() === wanted) : cats?.[0];
      if (found) catalogId = found.id;
      else {
        const { data: created, error: createErr } = await supabase
          .from("ccd_catalogs")
          .insert({ user_id: ctx.getUserId(), name: input.catalog_name?.trim() || "POZOR", sort_order: cats?.length ?? 0 })
          .select("id")
          .single();
        if (createErr) return fail(createErr.message);
        catalogId = created.id;
      }
    }
    const { data, error } = await supabase
      .from("ccd_targets")
      .insert({
        user_id: ctx.getUserId(),
        catalog_id: catalogId,
        name: input.name,
        constellation: input.constellation ?? "",
        ra_hours: input.ra_hours,
        dec_deg: input.dec_deg,
        epoch_jd: input.epoch_jd ?? null,
        period_days: input.period_days ?? null,
        filters: input.filters ?? null,
        notes: input.notes ?? null,
      })
      .select("id,catalog_id,name,constellation,ra_hours,dec_deg,epoch_jd,period_days,filters,notes")
      .single();
    if (error) return fail(error.message);
    return ok(data, { target: data });
  },
});