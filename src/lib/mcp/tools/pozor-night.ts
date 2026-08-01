import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { unauthenticated } from "../supabase";
import { LOCATION_KEYS, iso, ok, resolveLocation } from "../helpers";
import { moonAltitude, nightInfo, twilightTimes, utcDate } from "../../pozor";
import * as Astronomy from "astronomy-engine";

export default defineTool({
  name: "pozor_night",
  title: "POZOR night conditions",
  description:
    "Astronomical night boundaries, twilight times, Moon phase/illumination and Moon altitude for a given date and observing site.",
  inputSchema: {
    date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Evening date of the night, YYYY-MM-DD (UTC)."),
    location: z.string().trim().optional().describe(`Site key: ${LOCATION_KEYS.join(", ")}.`),
    lat: z.number().min(-90).max(90).optional().describe("Custom latitude (degrees north)."),
    lon: z.number().min(-180).max(180).optional().describe("Custom longitude (degrees east)."),
    elevation: z.number().optional().describe("Custom elevation in metres."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date, ...loc }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const site = resolveLocation(loc);
    const night = nightInfo(date, site);
    const tw = twilightTimes(date, site);
    const mid = night.start && night.end ? new Date((night.start.getTime() + night.end.getTime()) / 2) : utcDate(date, 0);
    const illum = Astronomy.Illumination(Astronomy.Body.Moon, mid);
    const payload = {
      date,
      site: { key: site.key, label: site.label, lat: site.lat, lon: site.lon, elevation: site.elevation },
      night: {
        start: iso(night.start),
        end: iso(night.end),
        durationHours:
          night.start && night.end
            ? Number(((night.end.getTime() - night.start.getTime()) / 3600e3).toFixed(3))
            : null,
        moonRise: iso(night.moonRise),
        moonSet: iso(night.moonSet),
        moonPhasePercent: night.moonPhasePercent,
      },
      twilight: {
        sunset: iso(tw.sunset),
        civilDusk: iso(tw.civilDusk),
        nauticalDusk: iso(tw.nauticalDusk),
        astroDusk: iso(tw.astroDusk),
        astroDawn: iso(tw.astroDawn),
        nauticalDawn: iso(tw.nauticalDawn),
        civilDawn: iso(tw.civilDawn),
        sunrise: iso(tw.sunrise),
      },
      moon: {
        atUtc: iso(mid),
        phaseAngleDeg: illum.phase_angle,
        illuminatedFraction: illum.phase_fraction,
        altitudeDeg: Number(moonAltitude(mid, site).toFixed(2)),
      },
    };
    return ok(payload, payload as unknown as Record<string, unknown>);
  },
});