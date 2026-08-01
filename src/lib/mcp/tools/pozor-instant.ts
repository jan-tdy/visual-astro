import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { unauthenticated } from "../supabase";
import { LOCATION_KEYS, fail, iso, ok, resolveLocation } from "../helpers";
import { formatDMS, formatHMS, heliocentricPhase, instantInfo } from "@/lib/pozor";
import { resolveTarget } from "./pozor-target";

export default defineTool({
  name: "pozor_instant",
  title: "POZOR position at an instant",
  description:
    "Altitude, azimuth, hour angle, airmass, precessed coordinates, heliocentric JD correction and eclipsing phase for a target at a given UTC instant.",
  inputSchema: {
    datetime_utc: z.string().trim().describe("UTC instant in ISO format, e.g. 2026-08-01T22:30:00Z."),
    target_id: z.string().uuid().optional().describe("CCD catalog target id."),
    target_name: z.string().trim().min(1).optional().describe("CCD catalog target name."),
    ra_hours: z.number().min(0).max(24).optional().describe("J2000 RA in hours (instead of a catalog target)."),
    dec_deg: z.number().min(-90).max(90).optional().describe("J2000 Dec in degrees."),
    epoch_jd: z.number().optional().describe("Epoch of minimum (JD) for phase."),
    period_days: z.number().positive().optional().describe("Period in days for phase."),
    location: z.string().trim().optional().describe(`Site key: ${LOCATION_KEYS.join(", ")}.`),
    lat: z.number().min(-90).max(90).optional().describe("Custom latitude."),
    lon: z.number().min(-180).max(180).optional().describe("Custom longitude."),
    elevation: z.number().optional().describe("Custom elevation in metres."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { target, error } = await resolveTarget(ctx, input);
    if (error || !target) return fail(error ?? "Target not resolved.");
    const when = new Date(input.datetime_utc);
    if (Number.isNaN(when.getTime())) return fail("Invalid datetime_utc.");
    const site = resolveLocation(input);
    const info = instantInfo(target.raHours, target.decDeg, when, site);
    const payload = {
      target: { name: target.name, raHoursJ2000: target.raHours, decDegJ2000: target.decDeg },
      site: { key: site.key, label: site.label },
      atUtc: iso(when),
      raOfDate: formatHMS(info.raOfDate),
      decOfDate: formatDMS(info.decOfDate),
      altitudeDeg: Number(info.altDeg.toFixed(3)),
      azimuthDeg: Number(info.azDeg.toFixed(3)),
      hourAngleHours: Number(info.haHours.toFixed(4)),
      lstHours: Number(info.lstHours.toFixed(4)),
      airmass: info.airmass,
      jd: info.jd,
      jdHel: info.jdHel,
      helCorrDays: info.helCorrDays,
      phase: heliocentricPhase(when, target),
    };
    return ok(payload, payload as unknown as Record<string, unknown>);
  },
});