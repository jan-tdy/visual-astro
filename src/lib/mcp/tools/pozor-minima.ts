import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { unauthenticated } from "../supabase";
import { LOCATION_KEYS, MIN_ALT_DEFAULT, fail, iso, ok, resolveLocation } from "../helpers";
import { isPlusActive, plusRequired } from "../subscription";
import { minimaInRange } from "../../pozor";
import { resolveTarget } from "./pozor-target";

export default defineTool({
  name: "pozor_minima",
  title: "POZOR minima predictions",
  description:
    "Predicted minima of an eclipsing target in a date range, with geocentric and heliocentric JD, altitude, airmass and whether the minimum falls inside the observable night.",
  inputSchema: {
    from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Range start date, YYYY-MM-DD."),
    to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Range end date, YYYY-MM-DD."),
    target_id: z.string().uuid().optional().describe("CCD catalog target id."),
    target_name: z.string().trim().min(1).optional().describe("CCD catalog target name."),
    ra_hours: z.number().min(0).max(24).optional().describe("J2000 RA in hours."),
    dec_deg: z.number().min(-90).max(90).optional().describe("J2000 Dec in degrees."),
    epoch_jd: z.number().optional().describe("Epoch of primary minimum (JD)."),
    period_days: z.number().positive().optional().describe("Period in days."),
    min_altitude: z.number().min(0).max(90).default(MIN_ALT_DEFAULT).describe("Minimum usable altitude in degrees."),
    only_observable: z.boolean().default(true).describe("Keep only minima observable from the site."),
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
    if (!target.epochJd || !target.periodDays) return fail("This target has no epoch/period ephemeris.");
    const site = resolveLocation(input);
    const minAlt = input.min_altitude ?? MIN_ALT_DEFAULT;
    const events = minimaInRange(
      { raHours: target.raHours, decDeg: target.decDeg, epochJd: target.epochJd, periodDays: target.periodDays },
      input.from,
      input.to,
      site,
      minAlt,
      input.only_observable !== false,
    ).map((e) => ({
      epoch: e.epoch,
      utc: iso(e.date),
      jd: e.jd,
      jdHel: e.jdHel,
      helCorrDays: e.helCorrDays,
      altitudeDeg: Number(e.altDeg.toFixed(2)),
      airmass: e.airmass,
      duringNight: e.duringNight,
      aboveMinAltitude: e.aboveMinAlt,
    }));
    const payload = {
      target: { name: target.name, epochJd: target.epochJd, periodDays: target.periodDays },
      site: { key: site.key, label: site.label },
      minAltitudeDeg: minAlt,
      minima: events,
    };
    return ok(payload, payload as unknown as Record<string, unknown>);
  },
});