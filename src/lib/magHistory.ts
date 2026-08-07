/**
 * Compare a freshly typed observation against what the same star looked like in
 * this observer's earlier sessions.
 *
 * The point is transcription errors, not astrophysics: a "3" and a "5" written
 * in a hurry on a night sheet are easy to mix up, and the resulting row is
 * perfectly well-formed — nothing else in the app can catch it. So we flag a
 * value that sits far from the star's own history and ask the observer to look
 * again. Variables do vary, and a genuine outburst is exactly the observation
 * worth keeping, so these are *checks*, never corrections.
 */
import { computeMagnitude, parseLimitMagnitude, resolveCompValue } from "./astro";

export type HistoryObs = {
  star_id: string;
  a?: string | null;
  b?: string | null;
  pasos_a?: number | null;
  pasos_b?: number | null;
  limit_value?: string | null;
};

/** The numeric quantities we track per star. */
export type HistoryField = "mag" | "a" | "b" | "pasos_a" | "pasos_b" | "limit";

/**
 * Fields actually compared against history. Argelander step counts (pasos_a/
 * pasos_b) are excluded on purpose: they are freely chosen by the observer on
 * the night and have no "typical" value to deviate from, so checking them
 * only produced false "invalid" warnings (see issue #41).
 */
export const HISTORY_FIELDS: HistoryField[] = ["mag", "a", "b", "limit"];

export type FieldStat = { n: number; mean: number; sd: number; min: number; max: number };
export type StarHistory = Partial<Record<HistoryField, FieldStat>>;

/** Fewer past values than this and a "deviation" means nothing. */
export const MIN_HISTORY = 3;

/** Default magnitude tolerance (mag) — overridable in Settings. */
export const DEFAULT_MAG_TOLERANCE = 1.0;

/**
 * A star whose past values are genuinely spread out (an outbursting dwarf nova
 * swings several magnitudes) must not warn on every row, so the tolerance is
 * widened to this many standard deviations when that is the looser bound.
 */
export const SIGMA_FACTOR = 2.5;

/** Steps are small integers, so their tolerance is a count, not a magnitude. */
export const PASOS_TOLERANCE = 3;

/** Pull the numeric value of one field out of an observation, or null. */
export function fieldValue(
  o: HistoryObs,
  field: HistoryField,
  starName?: string,
): number | null {
  switch (field) {
    case "mag": {
      const m = computeMagnitude(o, starName);
      return m.numeric;
    }
    case "a":
    case "b": {
      const v = resolveCompValue(starName, o[field] ?? null);
      return Number.isFinite(v) ? v : null;
    }
    case "pasos_a":
    case "pasos_b": {
      const v = o[field];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }
    case "limit":
      return parseLimitMagnitude(o.limit_value ?? null);
  }
}

function statOf(values: number[]): FieldStat | undefined {
  if (values.length === 0) return undefined;
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    mean,
    sd: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Aggregate past observations into per-star, per-field statistics.
 * `starNameById` is needed because letter comparators ("a", "za") only resolve
 * to a magnitude through the star's own comparison table.
 */
export function buildStarHistory(
  rows: HistoryObs[],
  starNameById: Map<string, string>,
): Map<string, StarHistory> {
  const raw = new Map<string, Record<HistoryField, number[]>>();
  for (const row of rows) {
    let bucket = raw.get(row.star_id);
    if (!bucket) {
      bucket = { mag: [], a: [], b: [], pasos_a: [], pasos_b: [], limit: [] };
      raw.set(row.star_id, bucket);
    }
    const name = starNameById.get(row.star_id);
    for (const f of HISTORY_FIELDS) {
      const v = fieldValue(row, f, name);
      if (v !== null) bucket[f].push(v);
    }
  }
  const out = new Map<string, StarHistory>();
  for (const [starId, bucket] of raw) {
    const hist: StarHistory = {};
    for (const f of HISTORY_FIELDS) {
      const s = statOf(bucket[f]);
      if (s) hist[f] = s;
    }
    out.set(starId, hist);
  }
  return out;
}

export type HistoryOutlier = {
  field: HistoryField;
  value: number;
  stat: FieldStat;
  /** How far the value had to fall outside the mean before we said anything. */
  threshold: number;
};

export type OutlierOptions = {
  /** Magnitude tolerance from Settings (mag). Falls back to the default. */
  tolerance?: number;
  minHistory?: number;
};

/** The band around the historical mean that a value may occupy without comment. */
export function thresholdFor(field: HistoryField, stat: FieldStat, tolerance: number): number {
  const floor = field === "pasos_a" || field === "pasos_b" ? PASOS_TOLERANCE : tolerance;
  return Math.max(floor, SIGMA_FACTOR * stat.sd);
}

/**
 * Check one observation against a star's history. Returns every field that sits
 * outside its tolerance band — magnitude first, since that is the one the
 * observer actually reports.
 */
export function findOutliers(
  o: HistoryObs,
  hist: StarHistory | undefined,
  starName: string | undefined,
  opts: OutlierOptions = {},
): HistoryOutlier[] {
  if (!hist) return [];
  const tolerance = opts.tolerance ?? DEFAULT_MAG_TOLERANCE;
  const minHistory = opts.minHistory ?? MIN_HISTORY;
  const out: HistoryOutlier[] = [];
  for (const field of HISTORY_FIELDS) {
    const stat = hist[field];
    if (!stat || stat.n < minHistory) continue;
    const value = fieldValue(o, field, starName);
    if (value === null) continue;
    const threshold = thresholdFor(field, stat, tolerance);
    if (Math.abs(value - stat.mean) > threshold) {
      out.push({ field, value, stat, threshold });
    }
  }
  return out;
}
