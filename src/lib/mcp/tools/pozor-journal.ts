import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { unauthenticated } from "../supabase";
import { LOCATION_KEYS, MIN_ALT_DEFAULT, fail, iso, ok, resolveLocation } from "../helpers";
import { isPlusActive, plusRequired } from "../subscription";
import { buildJournal } from "../../pozor";
import { resolveTarget } from "./pozor-target";

export default defineTool({
  name: "pozor_journal",
  title: "POZOR observability journal",
  description:
    "Night-by-night observability windows for a target between two dates: when it is above the minimum altitude during astronomical night, plus maximum altitude and eclipsing phase at the window edges.",
  inputSchema: {
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).describe("First evening date, YYYY-MM-DD."),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Last evening date, YYYY-MM-DD."),
    target_id: z.string().uuid().optional().describe("CCD catalog target id."),
    target_name: z.string().trim().min(1).optional().describe("CCD catalog target name."),
    ra_hours: z.number().min(0).max(24).optional().describe("J2000 RA in hours."),
    dec_deg: z.number().min(-90).max(90).optional().describe("J2000 Dec in degrees."),
    epoch_jd: z.number().optional().describe("Epoch of minimum (JD)."),
    period_days: z.number().positive().optional().describe("Period in days."),
    min_altitude: z.number().min(0).max(90).default(MIN_ALT_DEFAULT).describe("Minimum usable altitude in degrees."),
    only_observable: z.boolean().default(true).describe("Return only nights with at least one window."),
    location: z.string().trim().optional().describe(`Site key: ${LOCATION_KEYS.join(", ")}.`),
    lat: z.number().min(-90).max(90).optional().describe("Custom latitude."),
    lon: z.number().min(-180).max(180).optional().describe("Custom longitude."),
    elevation: z.number().optional().describe("Custom elevation in metres."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    if (!(await isPlusActive(ctx))) return plusRequired();
    const { target, error } = await resolveTarget(ctx, input);
    if (error || !target) return fail(error ?? "Target not resolved.");
    const site = resolveLocation(input);
    const minAlt = input.min_altitude ?? MIN_ALT_DEFAULT;
    const rows = buildJournal(target, input.from, input.to, site, minAlt)
      .filter((r) => (input.only_observable === false ? true : r.windows.length > 0))
      .map((r) => ({
        date: r.isoDate,
        jdMidnight: r.jdMidnight,
        nightStart: iso(r.night.start),
        nightEnd: iso(r.night.end),
        maxAltitudeDeg: Number(r.altMax.toFixed(2)),
        phaseFrom: r.phaseFrom,
        phaseTo: r.phaseTo,
        windows: r.windows.map((w) => ({ from: iso(w.from), to: iso(w.to) })),
      }));
    const payload = {
      target: { name: target.name, raHoursJ2000: target.raHours, decDegJ2000: target.decDeg },
      site: { key: site.key, label: site.label },
      minAltitudeDeg: minAlt,
      nights: rows,
    };
    return ok(payload, payload as unknown as Record<string, unknown>);
  },
});