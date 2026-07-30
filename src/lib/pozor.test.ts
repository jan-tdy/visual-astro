import { describe, expect, it } from "vitest";
import {
  altAz,
  airmass,
  dateToJD,
  getLocation,
  helioCorrection,
  instantInfo,
  jdToDate,
  utcDate,
} from "@/lib/pozor";

const piconcillo = getLocation("piconcillo");

// Golden values from the original Fortran POZOR program.
const ARCMIN = 1 / 60;

const V808AUR = { raHours: 7.19056, decDeg: 44.06806 };
const V2104AQL = { raHours: 19.24194, decDeg: 12.06472 };
const EPOCH = utcDate("2026-07-30", 22); // 30.7.2026 22:00:00 UT

describe("Julian Date round-trip", () => {
  it("matches the reference JD for 2026-07-30 22:00 UT", () => {
    expect(dateToJD(EPOCH)).toBeCloseTo(2461252.41667, 4);
  });

  it("jdToDate is the inverse of dateToJD", () => {
    const back = jdToDate(2461252.41667);
    expect(Math.abs(back.getTime() - EPOCH.getTime())).toBeLessThan(2000);
    for (const iso of ["1980-01-01", "2000-02-29", "2026-12-31"]) {
      const d = utcDate(iso, 13.25);
      expect(Math.abs(jdToDate(dateToJD(d)).getTime() - d.getTime())).toBeLessThan(1000);
    }
  });
});

describe("V808 Aur at Piconcillo, 2026-07-30 22:00 UT", () => {
  const info = instantInfo(V808AUR.raHours, V808AUR.decDeg, EPOCH, piconcillo);

  it("local sidereal time is 18h12m22s", () => {
    expect(info.lstHours).toBeCloseTo(18 + 12 / 60 + 22 / 3600, 3);
  });

  it("hour angle is 10h59m02s", () => {
    expect(info.haHours).toBeCloseTo(10 + 59 / 60 + 2 / 3600, 3);
  });

  it("altitude is −6°38′55″ (below the horizon), within 1 arcmin", () => {
    const expected = -(6 + 38 / 60 + 55 / 3600);
    expect(Math.abs(info.altDeg - expected)).toBeLessThan(ARCMIN);
    expect(info.airmass).toBeNull();
  });

  it("heliocentric JD is 2461252.41161 (correction −0.00505 d)", () => {
    expect(Math.abs(info.helCorrDays - -0.00505)).toBeLessThan(1e-4);
    expect(Math.abs(info.jdHel - 2461252.41161)).toBeLessThan(1e-4);
  });

  it("radial-velocity correction is about +10.45 km/s", () => {
    // The Fortran program used a low-precision solar-orbit model here, so this is
    // checked at the ~1 km/s level only.
    const hc = helioCorrection(V808AUR.raHours, V808AUR.decDeg, EPOCH);
    expect(Math.abs(hc.rvKmS - 10.45157)).toBeLessThan(1);
    expect(hc.rvKmS).toBeGreaterThan(0);
  });
});

describe("V2104 Aql at Piconcillo, 2026-07-30 22:00 UT", () => {
  const pos = altAz(V2104AQL.raHours, V2104AQL.decDeg, EPOCH, piconcillo);

  it("altitude is +60°21′, within 1 arcmin", () => {
    expect(Math.abs(pos.altDeg - (60 + 21 / 60))).toBeLessThan(ARCMIN);
  });

  it("air mass is 1.15032, within 0.01", () => {
    expect(Math.abs((airmass(pos.altDeg) ?? 0) - 1.15032)).toBeLessThan(0.01);
  });

  it("hour angle is 22h56m37s", () => {
    expect(pos.haHours).toBeCloseTo(22 + 56 / 60 + 37 / 3600, 3);
  });
});

describe("precession is applied", () => {
  it("shifts J2000 coordinates to the equinox of date", () => {
    const pos = altAz(V2104AQL.raHours, V2104AQL.decDeg, EPOCH, piconcillo);
    expect(pos.raOfDate).toBeGreaterThan(V2104AQL.raHours);
    expect(pos.raOfDate - V2104AQL.raHours).toBeLessThan 0.05;
  });
});