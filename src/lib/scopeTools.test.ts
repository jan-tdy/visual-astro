import { describe, it, expect } from "vitest";
import {
  computeEyepieceFov,
  computePlateScale,
  formatArcminAsDM,
  convertDistance,
  compareMagnitudes,
  magnitudeDiffFromFluxRatio,
} from "@/lib/scopeTools";

describe("computeEyepieceFov", () => {
  it("matches the fov.astro defaults (200mm/1000mm scope, 10mm/50deg eyepiece)", () => {
    const r = computeEyepieceFov(200, 1000, 10, 50);
    expect(r).not.toBeNull();
    expect(r!.fRatio).toBeCloseTo(5, 6);
    expect(r!.magnification).toBeCloseTo(100, 6);
    expect(r!.trueFovDeg).toBeCloseTo(0.5, 6);
    expect(r!.trueFovArcmin).toBeCloseTo(30, 6);
    expect(r!.exitPupilMm).toBeCloseTo(2, 6);
  });

  it("returns null when a required input is zero/missing", () => {
    expect(computeEyepieceFov(0, 1000, 10, 50)).toBeNull();
    expect(computeEyepieceFov(200, 0, 10, 50)).toBeNull();
    expect(computeEyepieceFov(200, 1000, 0, 50)).toBeNull();
  });
});

describe("computePlateScale", () => {
  it("matches the plate-scale.astro defaults", () => {
    const r = computePlateScale(1000, 3.76, 4144, 2822);
    expect(r).not.toBeNull();
    expect(r!.arcsecPerPixel).toBeCloseTo(0.7755564, 5);
    expect(r!.sensorWidthMm).toBeCloseTo(15.58, 2);
    expect(r!.sensorHeightMm).toBeCloseTo(10.61, 2);
    expect(r!.samplingKey).toBe("oversampled");
  });

  it("classifies sampling bands correctly", () => {
    expect(computePlateScale(1000, 1, 100, 100)!.samplingKey).toBe("oversampled"); // ~0.2"/px
    expect(computePlateScale(500, 3.76, 100, 100)!.samplingKey).toBe("wellMatched"); // ~1.55"/px
    expect(computePlateScale(300, 3.76, 100, 100)!.samplingKey).toBe("slightlyUndersampled"); // ~2.59"/px
    expect(computePlateScale(100, 3.76, 100, 100)!.samplingKey).toBe("undersampled"); // ~7.76"/px
  });

  it("returns null when a required input is zero/missing", () => {
    expect(computePlateScale(0, 3.76, 4144, 2822)).toBeNull();
  });
});

describe("formatArcminAsDM", () => {
  it("formats sub-degree values as arcminutes only", () => {
    expect(formatArcminAsDM(30)).toBe("30.0′");
  });

  it("formats values over 60' with a degree component", () => {
    expect(formatArcminAsDM(125.4)).toBe("2° 5.4′");
  });
});

describe("convertDistance", () => {
  it("round-trips 1 AU into km (IAU-adopted constant)", () => {
    const out = convertDistance(1, "au");
    expect(out.km).toBeCloseTo(149597870.7, 1);
  });

  it("converts 1 parsec to light-years using 3.26156 ly/pc", () => {
    const out = convertDistance(1, "pc");
    expect(out.ly).toBeCloseTo(3.26156378, 5);
  });

  it("is consistent both ways (au -> pc -> au)", () => {
    const pc = convertDistance(1, "au").pc;
    const au = convertDistance(pc, "pc").au;
    expect(au).toBeCloseTo(1, 6);
  });
});

describe("compareMagnitudes", () => {
  it("matches the magnitude.astro script's actual computation for A=5.0, B=6.0 (A is brighter/smaller mag)", () => {
    const r = compareMagnitudes(5.0, 6.0);
    expect(r.diff).toBeCloseTo(-1.0, 6);
    expect(r.fluxRatioAB).toBeCloseTo(2.511886, 5);
    expect(r.fluxRatioBA).toBeCloseTo(0.398107, 5);
    expect(r.brighter).toBe("A");
  });

  it("reports 'equal' when magnitudes match", () => {
    expect(compareMagnitudes(10, 10).brighter).toBe("equal");
  });
});

describe("magnitudeDiffFromFluxRatio", () => {
  it("matches the magnitude.astro example (ratio=2.512 -> ~1.0004 mag)", () => {
    expect(magnitudeDiffFromFluxRatio(2.512)).toBeCloseTo(1.0004, 3);
  });

  it("is the inverse of compareMagnitudes' flux ratio", () => {
    const r = compareMagnitudes(5.0, 6.0);
    expect(magnitudeDiffFromFluxRatio(r.fluxRatioAB)).toBeCloseTo(-r.diff, 6);
    expect(magnitudeDiffFromFluxRatio(r.fluxRatioBA)).toBeCloseTo(r.diff, 6);
  });

  it("returns null for non-positive or non-finite ratios", () => {
    expect(magnitudeDiffFromFluxRatio(0)).toBeNull();
    expect(magnitudeDiffFromFluxRatio(-1)).toBeNull();
    expect(magnitudeDiffFromFluxRatio(NaN)).toBeNull();
  });
});
