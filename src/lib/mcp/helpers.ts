import {
  DEFAULT_MIN_ALTITUDE,
  POZOR_LOCATIONS,
  getLocation,
  type PozorLocation,
} from "@/lib/pozor";

export function ok(payload: unknown, structured?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export const MIN_ALT_DEFAULT = DEFAULT_MIN_ALTITUDE;
export const LOCATION_KEYS = POZOR_LOCATIONS.map((l) => l.key);

/** Resolve a POZOR site: a known location key, or explicit lat/lon/elevation. */
export function resolveLocation(input: {
  location?: string;
  lat?: number;
  lon?: number;
  elevation?: number;
}): PozorLocation {
  if (typeof input.lat === "number" && typeof input.lon === "number") {
    return {
      key: "custom",
      label: "Custom",
      lat: input.lat,
      lon: input.lon,
      elevation: input.elevation ?? 0,
    };
  }
  return getLocation(input.location ?? "");
}

export const iso = (d: Date | null) => (d ? d.toISOString() : null);