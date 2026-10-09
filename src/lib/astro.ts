// Astronomical helpers: Julian Date conversion + magnitude estimate.

/**
 * Convert a Date (UTC) to Julian Date (full).
 * Standard Meeus algorithm.
 */
export function dateToJD(d: Date): number {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day =
    d.getUTCDate() +
    (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) / 24;

  let Y = year;
  let M = month;
  if (M <= 2) {
    Y -= 1;
    M += 12;
  }
  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (Y + 4716)) +
    Math.floor(30.6001 * (M + 1)) +
    day +
    B -
    1524.5
  );
}

/** YYYYMMDD.fff for VSNET (UT date with day fraction, 3 decimals). */
export function vsnetDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = d.getUTCDate();
  const frac =
    (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) / 24;
  const dayWithFrac = (day + frac).toFixed(3).padStart(6, "0");
  return `${y}${m}${dayWithFrac}`;
}

/** Filename prefix yyyymmdd */
export function filenameDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export interface ObsInput {
  a?: string | null;
  pasos_a?: number | null;
  pasos_b?: number | null;
  b?: string | null;
  limit_value?: string | null;
}

import { getPromStar } from "./promStore";

// AAVSO comparison stars are labelled with their magnitude and the decimal
// point dropped, which is how they appear both on the charts and on the
// observer's sheet: "105" is a 10.5-mag star, "79" is 7.9. Taken literally
// those produce magnitudes like 85.50 for T CrB instead of 8.55 (see
// resolveCompValue below).
//
// The split is physical rather than a guess about notation: a visual
// observer can record something bright (magnitude 3), but nothing past
// about this value is visible through the telescope at all, so a literal
// reading above it cannot be a magnitude and must be a label. Below it the
// literal reading is kept — "12" stays 12.0 rather than becoming 1.2. This
// is a real ambiguity zone (a two-digit label and a two-digit magnitude look
// identical), so it's user-tunable in Settings rather than fixed in code —
// see UserPrefs.compLabelThreshold, which is what everything in the app
// actually passes here; this constant is only the fallback when no
// preference is available (tests, and the server-side MCP tools, which have
// no access to a particular browser's local setting).
export const DEFAULT_COMP_LABEL_THRESHOLD = 20;

/**
 * Resolve a comparator value: either a numeric string ("4.02") or a single letter
 * ("a", "B", "za") that maps to a magnitude in the per-star comparator table
 * (sheet "prom" of the original ODS). Returns NaN if not resolvable.
 */
export function resolveCompValue(
  starName: string | undefined,
  raw: string | null | undefined,
  labelThreshold: number = DEFAULT_COMP_LABEL_THRESHOLD,
): number {
  if (raw == null) return NaN;
  const s = String(raw).trim();
  if (!s) return NaN;
  const direct = parseFloat(s);
  if (Number.isFinite(direct) && /^-?\d/.test(s)) {
    // Values carrying an explicit decimal point are magnitudes already and
    // are never rescaled — see DEFAULT_COMP_LABEL_THRESHOLD above.
    if (!s.includes(".") && Math.abs(direct) > labelThreshold) return direct / 10;
    return direct;
  }
  if (!starName) return NaN;
  const tbl = getPromStar(starName);
  if (!tbl) return NaN;
  const v = tbl[s.toLowerCase()];
  return typeof v === "number" ? v : NaN;
}

/**
 * Compute the visual magnitude using the Argelander step method:
 *   mag = A + (Pasos A / (Pasos A + Pasos B)) * (B - A)
 * Returns a string formatted to 2 decimals, or a "<x.x" limit, or null if not estimable.
 */
export function computeMagnitude(
  o: ObsInput,
  starName?: string,
  labelThreshold: number = DEFAULT_COMP_LABEL_THRESHOLD,
): { value: string | null; numeric: number | null } {
  if (o.limit_value && o.limit_value.trim()) {
    return { value: o.limit_value.trim(), numeric: null };
  }
  const aNum = resolveCompValue(starName, o.a ?? null, labelThreshold);
  const bNum = resolveCompValue(starName, o.b ?? null, labelThreshold);
  const pa = o.pasos_a ?? null;
  const pb = o.pasos_b ?? null;
  if (
    Number.isFinite(aNum) &&
    Number.isFinite(bNum) &&
    pa !== null &&
    pb !== null &&
    pa + pb > 0
  ) {
    const mag = aNum + (pa / (pa + pb)) * (bNum - aNum);
    return { value: mag.toFixed(2), numeric: mag };
  }
  return { value: null, numeric: null };
}

/**
 * Overlay a "HH:MM" UT time onto a session's (evening) date, mutating `d` in place.
 * Times 00:00–11:59 UT are the post-midnight continuation of the observing night
 * that started the previous UTC evening, so they roll onto the next calendar day —
 * the session itself is always dated by the evening it started.
 */
export function applyUtTimeToDate(d: Date, utTime: string | null | undefined): void {
  if (!utTime) return;
  const m = /^(\d{1,2})[:.\s]+(\d{1,2})/.exec(String(utTime).trim());
  if (!m) return;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  d.setUTCHours(hh, mm, 0, 0);
  if (hh < 12) d.setUTCDate(d.getUTCDate() + 1);
}

/**
 * Extract the numeric threshold from a "fainter-than" limit string (e.g. "<14.9").
 * The star was not seen even at this comparison magnitude, so the true magnitude
 * is fainter (numerically greater) than the returned value. Returns null if unparseable.
 */
export function parseLimitMagnitude(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const v = parseFloat(m[0]);
  return Number.isFinite(v) ? v : null;
}

/** A unit mark attached to one sexagesimal component, classified by which
 *  slot it belongs in: "first" (h/d/°), "minute" (m/′/'), "second" (s/″/"),
 *  or "generic" (a bare colon/space separator, which fits any slot). */
type SexagesimalUnit = "first" | "minute" | "second" | "generic";

function sexagesimalUnitOf(ch: string): SexagesimalUnit {
  const c = ch.toLowerCase();
  if (c === "h" || c === "d" || c === "°") return "first";
  if (c === "m" || c === "′" || c === "'") return "minute";
  if (c === "s" || c === "″" || c === '"') return "second";
  return "generic";
}

/** Split a sign-free sexagesimal string into its 1-3 numeric components and
 *  the unit mark (if any) that followed each one. Returns null if the whole
 *  string isn't a clean sequence of (number, optional single separator). */
function tokenizeSexagesimal(s: string): { nums: number[]; units: SexagesimalUnit[] } | null {
  const nums: number[] = [];
  const units: SexagesimalUnit[] = [];
  const n = s.length;
  let i = 0;
  const isDigit = (ch: string) => ch >= "0" && ch <= "9";
  while (i < n) {
    while (i < n && /\s/.test(s[i])) i++;
    if (i >= n) break;

    const digitsStart = i;
    while (i < n && isDigit(s[i])) i++;
    if (i === digitsStart) return null;
    if (s[i] === ".") {
      const dotIdx = i;
      i++;
      const fracStart = i;
      while (i < n && isDigit(s[i])) i++;
      if (i === fracStart) { i = dotIdx; }
    }
    nums.push(Number(s.slice(digitsStart, i)));

    while (i < n && /\s/.test(s[i])) i++;
    let unit: SexagesimalUnit = "generic";
    if (i < n && /[:hdms°′″'"]/i.test(s[i])) {
      unit = sexagesimalUnitOf(s[i]);
      i++;
    }
    units.push(unit);
    while (i < n && /\s/.test(s[i])) i++;
  }
  if (nums.length < 1 || nums.length > 3) return null;
  return { nums, units };
}

/** Parse a sexagesimal coordinate string into decimal degrees.
 *  Accepts formats like "12 34 56.7", "12:34:56.7", "12h34m56.7s" (RA)
 *  or "+65 43 21.1", "-65:43:21.1", "65d43m21.1s" (Dec).
 *  The seconds component (and its separator) may be omitted, e.g. "12 34"
 *  or "+65 43". A decimal comma ("12,3456", "12 34,5") is accepted anywhere
 *  a decimal point would be. A sign is only honored on the whole coordinate
 *  (its very first character); an explicit unit mark that lands on the
 *  wrong component (e.g. "07h11s", hours then seconds with minutes skipped)
 *  is rejected rather than silently mis-parsed.
 *  For RA (isHours=true) the result is hours*15.
 *  Returns null if the input cannot be parsed meaningfully. */
export function parseSexagesimal(raw: string | null | undefined, isHours = false): number | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  let sign = 1;
  let body = trimmed;
  if (body[0] === "+" || body[0] === "-") {
    if (body[0] === "-") sign = -1;
    body = body.slice(1);
  }
  body = body.replace(/,/g, ".").trim();
  if (!body) return null;

  const tokenized = tokenizeSexagesimal(body);
  if (!tokenized) return null;
  const { nums, units } = tokenized;

  const expectedUnits: SexagesimalUnit[] = ["first", "minute", "second"];
  for (let idx = 0; idx < units.length; idx++) {
    if (units[idx] !== "generic" && units[idx] !== expectedUnits[idx]) return null;
  }

  let value: number;
  if (nums.length === 1) {
    value = nums[0] * sign;
  } else {
    const [a, b = 0, c = 0] = nums;
    if (b >= 60 || c >= 60) return null;
    value = (a + b / 60 + c / 3600) * sign;
  }

  if (isHours) {
    if (value < 0 || value >= 24) return null;
    return value * 15;
  }

  if (value < -90 || value > 90) return null;
  return value;
}

export function formatDecimalDegrees(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return v.toFixed(6);
}
