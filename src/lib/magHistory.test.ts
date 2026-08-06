import { describe, it, expect } from "vitest";
import {
  buildStarHistory,
  findOutliers,
  thresholdFor,
  type HistoryObs,
} from "@/lib/magHistory";

const NAMES = new Map([["s1", "TEST Star"]]);

/** Numeric comparators keep the fixture independent of the prom comparator tables. */
const obs = (a: string, pa: number, pb: number, b: string): HistoryObs => ({
  star_id: "s1", a, pasos_a: pa, pasos_b: pb, b, limit_value: null,
});

describe("buildStarHistory", () => {
  it("averages the computed magnitude across past rows", () => {
    // mag = A + pa/(pa+pb) * (B - A) → 15.0, 15.0, 15.0
    const hist = buildStarHistory([obs("15.0", 1, 1, "15.0"), obs("14.0", 1, 1, "16.0"), obs("15.0", 2, 2, "15.0")], NAMES);
    expect(hist.get("s1")?.mag?.n).toBe(3);
    expect(hist.get("s1")?.mag?.mean).toBeCloseTo(15.0, 5);
    expect(hist.get("s1")?.mag?.sd).toBeCloseTo(0, 5);
  });

  it("tracks the comparator values separately", () => {
    const hist = buildStarHistory([obs("14.0", 1, 1, "16.0"), obs("14.0", 1, 1, "16.0"), obs("14.0", 1, 1, "16.0")], NAMES);
    expect(hist.get("s1")?.a?.mean).toBeCloseTo(14.0, 5);
    expect(hist.get("s1")?.b?.mean).toBeCloseTo(16.0, 5);
  });

  it("skips rows whose magnitude cannot be computed", () => {
    const hist = buildStarHistory(
      [obs("15.0", 1, 1, "15.0"), { star_id: "s1", a: null, b: null, pasos_a: null, pasos_b: null, limit_value: null }],
      NAMES,
    );
    expect(hist.get("s1")?.mag?.n).toBe(1);
  });
});

describe("findOutliers", () => {
  const past = [obs("15.0", 1, 1, "15.0"), obs("15.2", 1, 1, "15.2"), obs("15.3", 1, 1, "15.3"), obs("15.5", 1, 1, "15.5")];
  const hist = buildStarHistory(past, NAMES).get("s1");

  it("flags a magnitude far from the historical mean", () => {
    const found = findOutliers(obs("13.4", 1, 1, "13.5"), hist, "TEST Star", { tolerance: 1 });
    expect(found.some((f) => f.field === "mag")).toBe(true);
  });

  it("stays quiet for a value inside the tolerance", () => {
    const found = findOutliers(obs("15.1", 1, 1, "15.3"), hist, "TEST Star", { tolerance: 1 });
    expect(found).toEqual([]);
  });

  it("honours a tighter user tolerance", () => {
    const nudged = obs("14.6", 1, 1, "14.6"); // 0.65 mag below the mean
    expect(findOutliers(nudged, hist, "TEST Star", { tolerance: 1 })).toEqual([]);
    expect(findOutliers(nudged, hist, "TEST Star", { tolerance: 0.3 }).some((f) => f.field === "mag")).toBe(true);
  });

  it("says nothing when there is too little history", () => {
    const thin = buildStarHistory([obs("15.0", 1, 1, "15.0")], NAMES).get("s1");
    expect(findOutliers(obs("9.0", 1, 1, "9.0"), thin, "TEST Star", { tolerance: 1 })).toEqual([]);
  });

  it("widens the band for a star that genuinely swings", () => {
    // A dwarf nova between outburst and quiescence: sd is large, so an
    // in-range value must not warn even though it is far from the mean.
    const swingy = buildStarHistory(
      [obs("8.0", 1, 1, "8.0"), obs("12.0", 1, 1, "12.0"), obs("8.5", 1, 1, "8.5"), obs("11.5", 1, 1, "11.5")],
      NAMES,
    ).get("s1");
    expect(findOutliers(obs("12.5", 1, 1, "12.5"), swingy, "TEST Star", { tolerance: 1 })).toEqual([]);
  });
});

describe("thresholdFor", () => {
  it("uses the tolerance when the history is tight", () => {
    expect(thresholdFor("mag", { n: 5, mean: 15, sd: 0.1, min: 14.9, max: 15.1 }, 1)).toBe(1);
  });
  it("uses 2.5 sigma when the history is spread out", () => {
    expect(thresholdFor("mag", { n: 5, mean: 10, sd: 2, min: 8, max: 12 }, 1)).toBe(5);
  });
  it("measures steps in steps, not magnitudes", () => {
    expect(thresholdFor("pasos_a", { n: 5, mean: 2, sd: 0, min: 2, max: 2 }, 0.5)).toBe(3);
  });
});
