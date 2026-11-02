/**
 * Pure helpers for the "JapyScope" tab: matching a raw object_name reported
 * by a JapyScope Remote (Pi) against the observer's star catalog, and
 * formatting its UTC timestamps for display/entry.
 */
import { buildStarMatchIndex, matchStarToken, type StarMatchIndex } from "@/lib/rawParse";

export type MatchableStar = {
  id: string;
  name: string;
  vsnet_code: string | null;
  aavso_code: string | null;
};

export type StarLookup = {
  byToken: Map<string, MatchableStar>;
  /** Tokens shared by two or more stars (same normalised name, VSNET, or AAVSO code) — never auto-matched. */
  ambiguousTokens: Set<string>;
  matchIndex: StarMatchIndex;
};

const norm = (x: string) => x.toLowerCase().replace(/\s+/g, "");

/** Same normalised name/VSNET/AAVSO-code index SessionEditor's RAW mode builds, extracted for reuse. */
export function buildStarLookup(stars: MatchableStar[]): StarLookup {
  const byToken = new Map<string, MatchableStar>();
  const ambiguousTokens = new Set<string>();
  const put = (token: string, star: MatchableStar) => {
    const prev = byToken.get(token);
    if (prev && prev.id !== star.id) {
      // Two different stars share this token (e.g. the same name typed with
      // different catalogs) — picking either silently would risk assigning
      // the wrong one, so leave it for the observer to match by hand instead.
      ambiguousTokens.add(token);
    }
    byToken.set(token, star);
  };
  for (const s of stars) {
    put(norm(s.name), s);
    if (s.vsnet_code) put(norm(s.vsnet_code), s);
    if (s.aavso_code) put(norm(s.aavso_code), s);
  }
  return { byToken, ambiguousTokens, matchIndex: buildStarMatchIndex(Array.from(byToken.keys())) };
}

/**
 * Fuzzy-match a Pi-reported object_name (unnormalised, may contain spaces/
 * punctuation) against the catalog, reusing the same autocorrect tiers RAW
 * mode uses (exact / designation+constellation / truncation / typo).
 * Returns null when nothing matches closely enough — the event then stays
 * "unassigned" in the JapyScope tab.
 *
 * Unlike a RAW-mode line, there's no trailing comparator data to explain
 * leftover characters, so only a match that consumes the *entire* normalised
 * name counts — a mere prefix match would otherwise mis-assign e.g. "RX
 * Andromedae" (a free-text name a Pi catalog might send) to catalog star
 * "RX And" while silently discarding "romedae".
 */
export function matchObjectName(objectName: string, lookup: StarLookup): MatchableStar | null {
  const s = norm(objectName);
  if (!s || lookup.ambiguousTokens.has(s)) return null;
  const exact = lookup.byToken.get(s);
  if (exact) return exact;
  const m = matchStarToken(s, lookup.matchIndex, { fuzzy: true });
  if (!m || m.consumed !== s.length || lookup.ambiguousTokens.has(m.token)) return null;
  return lookup.byToken.get(m.token) ?? null;
}

const PRAGUE_TZ = "Europe/Prague";

function partsInZone(iso: string, timeZone: string): { y: string; m: string; d: string; h: string; min: string } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = dtf.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute") };
}

/** "HH:MM" in the observer's local time (Europe/Prague) — for display only. */
export function formatPragueTime(iso: string): string {
  const p = partsInZone(iso, PRAGUE_TZ);
  // Intl can format midnight as "24:00" with hour12:false; normalise to "00:00".
  const h = p.h === "24" ? "00" : p.h;
  return `${h}:${p.min}`;
}

/** "YYYY-MM-DD" calendar date in Europe/Prague — used to bucket events by day in the sidebar calendar. */
export function pragueDateKey(iso: string): string {
  const p = partsInZone(iso, PRAGUE_TZ);
  return `${p.y}-${p.m}-${p.d}`;
}

/** "HH:MM" in UTC — matches the rest of the app's ut_time convention (see SessionEditor). */
export function formatUtHHMM(iso: string): string {
  const p = partsInZone(iso, "UTC");
  const h = p.h === "24" ? "00" : p.h;
  return `${h}:${p.min}`;
}

/**
 * The Prague calendar day `key` ("YYYY-MM-DD"), as a UTC instant that falls
 * on the same calendar date in both UTC and Europe/Prague (local noon in
 * Prague is always in the afternoon in UTC too, well clear of any DST
 * transition), so it's safe to feed into `dateToJD`/`observed_at_utc`
 * without the date silently rolling to the next/previous day.
 */
export function pragueDateKeyToUtcNoon(key: string): Date {
  const [y, m, d] = key.split("-").map((v) => parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

/** Human-readable duration ("3 min 25 s" / "1 h 04 min") for the pending-events list. */
export function formatDuration(startedAtIso: string, endedAtIso: string): string {
  const totalSeconds = Math.max(0, Math.round((new Date(endedAtIso).getTime() - new Date(startedAtIso).getTime()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(s).padStart(2, "0")} s`;
  return `${s} s`;
}
