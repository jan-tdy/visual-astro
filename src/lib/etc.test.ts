import { describe, it, expect } from "vitest";
import { computeExposure, unknownFilterError, angularToLinearSize, linearToAngularSize } from "@/lib/etc";

/** Default common inputs matching the original tool's defaults. */
const defaults = {
  diameterM: 0.18,
  throughput: 0.5,
  pixScaleArcsecPerPix: 0.86,
  readNoiseE: 1.5,
  darkCurrentEPerPixPerSec: 0.0014,
  seeingArcsec: 2,
  apertureRadiusArcsec: null as number | null,
  expTimeSec: 600,
  nExp: 600,
  skyMagPerArcsec2: 21.5,
  airmass: 1.0,
};

describe("computeExposure — point source", () => {
  it("matches a hand-computed reference value (V=18, defaults)", () => {
    const result = computeExposure(defaults, { mode: "point", magnitude: 18.0, filter: "V" });

    const area = Math.PI * (0.18 / 2) ** 2;
    const ap = 0.7 * 2; // seeing default, no override
    const apArea = Math.PI * ap * ap;
    const sigma = 2 / 2.355;
    const EE = 1 - Math.exp(-(ap * ap) / (2 * sigma * sigma));
    const zp = 1.1e10;
    const k = 0.15;
    const flux = zp * Math.pow(10, -0.4 * 18.0); // airmass=1 -> extinction term vanishes
    const sourceE = flux * area * 0.5 * 600 * EE;
    const skyFlux = zp * Math.pow(10, -0.4 * 21.5);
    const skyE = skyFlux * area * 0.5 * 600 * apArea;

    expect(result.apertureRadiusArcsec).toBeCloseTo(ap, 6);
    expect(result.apertureAreaArcsec2).toBeCloseTo(apArea, 6);
    expect(result.telescopeAreaM2).toBeCloseTo(area, 6);
    expect(result.sourceElectronsPerFrame).toBeCloseTo(sourceE, 0);
    expect(result.skyElectronsPerFrame).toBeCloseTo(skyE, 0);
  });

  it("applies the airmass extinction term", () => {
    const base = computeExposure(defaults, { mode: "point", magnitude: 15, filter: "V" });
    const highAirmass = computeExposure(
      { ...defaults, airmass: 2.0 },
      { mode: "point", magnitude: 15, filter: "V" },
    );
    // Higher airmass -> more extinction -> fewer source electrons.
    expect(highAirmass.sourceElectronsPerFrame).toBeLessThan(base.sourceElectronsPerFrame);
  });

  it("uses an explicit aperture radius when given instead of 0.7x seeing", () => {
    const result = computeExposure(
      { ...defaults, apertureRadiusArcsec: 3 },
      { mode: "point", magnitude: 15, filter: "V" },
    );
    expect(result.apertureRadiusArcsec).toBe(3);
  });

  it("throws for an unknown filter", () => {
    expect(() => computeExposure(defaults, { mode: "point", magnitude: 15, filter: "nope" })).toThrow(
      unknownFilterError("nope").message,
    );
  });

  it("produces a higher SNR for a brighter (lower-magnitude) source", () => {
    const bright = computeExposure(defaults, { mode: "point", magnitude: 12, filter: "V" });
    const faint = computeExposure(defaults, { mode: "point", magnitude: 18, filter: "V" });
    expect(bright.snrPerFrame).toBeGreaterThan(faint.snrPerFrame);
  });

  it("scales stacked SNR by sqrt(nExp) relative to the per-frame SNR", () => {
    const result = computeExposure({ ...defaults, nExp: 4 }, { mode: "point", magnitude: 15, filter: "V" });
    expect(result.snrStacked).toBeCloseTo(Math.sqrt(4) * result.snrPerFrame, 6);
  });
});

describe("computeExposure — broadband (extended source)", () => {
  it("does not apply encircled-energy correction (uses the full aperture area)", () => {
    const result = computeExposure(defaults, { mode: "broadband", surfaceMagPerArcsec2: 23, filter: "L" });
    const area = Math.PI * (0.18 / 2) ** 2;
    const ap = 0.7 * 2;
    const apArea = Math.PI * ap * ap;
    const zp = 1.5e10;
    const flux = zp * Math.pow(10, -0.4 * 23);
    const sourceE = flux * area * 0.5 * 600 * apArea;
    expect(result.sourceElectronsPerFrame).toBeCloseTo(sourceE, 0);
  });

  it("throws for an unknown filter", () => {
    expect(() =>
      computeExposure(defaults, { mode: "broadband", surfaceMagPerArcsec2: 23, filter: "nope" }),
    ).toThrow(unknownFilterError("nope").message);
  });
});

describe("computeExposure — narrowband (emission line)", () => {
  it("matches a hand-computed reference value for Hα", () => {
    const result = computeExposure(defaults, {
      mode: "narrow",
      lineFluxErgCm2SArcsec2: 4e-17,
      filter: "Ha",
      bandwidthOverrideNm: null,
    });

    const area = Math.PI * (0.18 / 2) ** 2;
    const ap = 0.7 * 2;
    const apArea = Math.PI * ap * ap;
    const lambdaM = 656.3 * 1e-9;
    const h = 6.626e-34, c = 2.998e8;
    const photonFlux = (4e-17 * 1e-3 * lambdaM) / (h * c);
    const sourceE = photonFlux * area * 0.5 * 600 * apArea;

    expect(result.sourceElectronsPerFrame).toBeCloseTo(sourceE, 10);
  });

  it("uses the bandwidth override instead of the filter's reference bandwidth when given", () => {
    const withoutOverride = computeExposure(defaults, {
      mode: "narrow",
      lineFluxErgCm2SArcsec2: 4e-17,
      filter: "Ha",
      bandwidthOverrideNm: null,
    });
    const withOverride = computeExposure(defaults, {
      mode: "narrow",
      lineFluxErgCm2SArcsec2: 4e-17,
      filter: "Ha",
      bandwidthOverrideNm: 6,
    });
    // Double the bandwidth -> double the sky electrons (source electrons unaffected).
    expect(withOverride.skyElectronsPerFrame).toBeCloseTo(2 * withoutOverride.skyElectronsPerFrame, 6);
    expect(withOverride.sourceElectronsPerFrame).toBeCloseTo(withoutOverride.sourceElectronsPerFrame, 10);
  });

  it("throws for an unknown filter", () => {
    expect(() =>
      computeExposure(defaults, {
        mode: "narrow",
        lineFluxErgCm2SArcsec2: 4e-17,
        filter: "nope",
        bandwidthOverrideNm: null,
      }),
    ).toThrow(unknownFilterError("nope").message);
  });

  it("applies extinction to the source counts too, not just the sky, so SNR doesn't rise with airmass", () => {
    const zenith = computeExposure(defaults, {
      mode: "narrow",
      lineFluxErgCm2SArcsec2: 4e-17,
      filter: "Ha",
      bandwidthOverrideNm: null,
    });
    const highAirmass = computeExposure(
      { ...defaults, airmass: 2.0 },
      { mode: "narrow", lineFluxErgCm2SArcsec2: 4e-17, filter: "Ha", bandwidthOverrideNm: null },
    );
    expect(highAirmass.sourceElectronsPerFrame).toBeLessThan(zenith.sourceElectronsPerFrame);
    expect(highAirmass.snrPerFrame).toBeLessThan(zenith.snrPerFrame);
  });
});

describe("computeExposure — noise model", () => {
  it("derives noise as the sqrt of the sum of all variance terms", () => {
    const result = computeExposure(defaults, { mode: "point", magnitude: 15, filter: "V" });
    const expectedVariance =
      result.sourceElectronsPerFrame
      + result.skyElectronsPerFrame
      + result.darkElectronsPerFrame
      + result.readNoiseVariancePerFrame;
    expect(result.noisePerFrame).toBeCloseTo(Math.sqrt(expectedVariance), 6);
  });

  it("returns SNR 0 rather than NaN/Infinity when noise is zero", () => {
    const result = computeExposure(
      { ...defaults, expTimeSec: 0, darkCurrentEPerPixPerSec: 0, readNoiseE: 0 },
      { mode: "point", magnitude: 15, filter: "V" },
    );
    expect(result.noisePerFrame).toBe(0);
    expect(result.snrPerFrame).toBe(0);
    expect(Number.isFinite(result.snrStacked)).toBe(true);
  });
});

describe("angularToLinearSize / linearToAngularSize", () => {
  it("matches the small-angle approximation (linearSize ~= distance * angleRad) for a small angle", () => {
    const distanceKm = 1.495978707e8; // 1 AU
    const angularSizeArcsec = 1; // 1" at 1 AU
    const linear = angularToLinearSize(distanceKm, angularSizeArcsec);
    const angleRad = (angularSizeArcsec / 3600) * (Math.PI / 180);
    expect(linear).toBeCloseTo(distanceKm * angleRad, 0);
  });

  it("round-trips through the inverse function", () => {
    const distanceKm = 3.0857e13; // ~1 pc
    const angularSizeArcsec = 2.5;
    const linear = angularToLinearSize(distanceKm, angularSizeArcsec);
    const angleBack = linearToAngularSize(distanceKm, linear);
    expect(angleBack).toBeCloseTo(angularSizeArcsec, 6);
  });

  it("doubling the distance at a fixed angular size doubles the linear size", () => {
    const a = angularToLinearSize(1000, 10);
    const b = angularToLinearSize(2000, 10);
    expect(b).toBeCloseTo(2 * a, 6);
  });

  it("doubling the linear size at a fixed distance doubles the angular size for small angles", () => {
    const a = linearToAngularSize(1e9, 1000);
    const b = linearToAngularSize(1e9, 2000);
    expect(b).toBeCloseTo(2 * a, 3);
  });
});
