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

/**
 * Resolve a comparator value: either a numeric string ("4.02") or a single letter
 * ("a", "B", "za") that maps to a magnitude in the per-star comparator table
 * (sheet "prom" of the original ODS). Returns NaN if not resolvable.
 */
export function resolveCompValue(starName: string | undefined, raw: string | null | undefined): number {
  if (raw == null) return NaN;
  const s = String(raw).trim();
  if (!s) return NaN;
  const direct = parseFloat(s);
  if (Number.isFinite(direct) && /^-?\d/.test(s)) return direct;
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
export function computeMagnitude(o: ObsInput, starName?: string): { value: string | null; numeric: number | null } {
  if (o.limit_value && o.limit_value.trim()) {
    return { value: o.limit_value.trim(), numeric: null };
  }
  const aNum = resolveCompValue(starName, o.a ?? null);
  const bNum = resolveCompValue(starName, o.b ?? null);
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
