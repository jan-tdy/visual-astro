import { describe, expect, it } from "vitest";
import {
  altAz,
  airmass,
  dateToJD,
  getLocation,
  helioCorrection,
  instantInfo,
  jdToDate,
  minimaTimesInRange,
  sunAltitude,
  twilightTimes,
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
    expect(pos.raOfDate - V2104AQL.raHours).toBeLessThan(0.05);
  });
});

describe("twilightTimes", () => {
  const tw = twilightTimes("2026-01-15", piconcillo);

  it("orders the evening crossings sunset -> civil -> nautical -> astronomical dusk", () => {
    expect(tw.sunset).not.toBeNull();
    expect(tw.civilDusk!.getTime()).toBeGreaterThan(tw.sunset!.getTime());
    expect(tw.nauticalDusk!.getTime()).toBeGreaterThan(tw.civilDusk!.getTime());
    expect(tw.astroDusk!.getTime()).toBeGreaterThan(tw.nauticalDusk!.getTime());
  });

  it("orders the morning crossings astronomical -> nautical -> civil dawn -> sunrise", () => {
    expect(tw.astroDusk!.getTime()).toBeLessThan(tw.astroDawn!.getTime());
    expect(tw.astroDawn!.getTime()).toBeLessThan(tw.nauticalDawn!.getTime());
    expect(tw.nauticalDawn!.getTime()).toBeLessThan(tw.civilDawn!.getTime());
    expect(tw.civilDawn!.getTime()).toBeLessThan(tw.sunrise!.getTime());
  });

  it("matches the actual (refraction-corrected) Sun altitude at each crossing, within 1°", () => {
    // SearchAltitude targets the geometric (unrefracted) altitude, while sunAltitude()
    // applies standard refraction (up to ~0.6° near the horizon) — allow for that offset.
    const checks: [Date | null, number][] = [
      [tw.sunset, 0],
      [tw.civilDusk, -6],
      [tw.nauticalDusk, -12],
      [tw.astroDusk, -18],
      [tw.astroDawn, -18],
      [tw.nauticalDawn, -12],
      [tw.civilDawn, -6],
      [tw.sunrise, 0],
    ];
    for (const [d, expected] of checks) {
      expect(Math.abs(sunAltitude(d!, piconcillo) - expected)).toBeLessThan(1);
    }
  });
});

describe("minimaTimesInRange", () => {
  // Algol-like short-period eclipsing binary: epoch at phase 0 on 2000-01-01 00:00 UT.
  const epochJd = dateToJD(utcDate("2000-01-01", 0));
  const periodDays = 2.8673043;

  it("places primary minima exactly on-epoch and secondary ones half a period later", () => {
    const from = utcDate("2026-01-01", 0);
    const to = utcDate("2026-01-10", 0);
    const events = minimaTimesInRange({ epochJd, periodDays }, from, to);
    expect(events.length).toBeGreaterThan(0);
    for (const ev of events) {
      const phase = ((ev.date.getTime() / 86400e3 + 2440587.5 - epochJd) / periodDays) % 1;
      const wrapped = phase < 0 ? phase + 1 : phase;
      const target = ev.kind === "primary" ? 0 : 0.5;
      const dist = Math.min(Math.abs(wrapped - target), 1 - Math.abs(wrapped - target));
      expect(dist).toBeLessThan(1e-6);
    }
    expect(events.some((e) => e.kind === "primary")).toBe(true);
    expect(events.some((e) => e.kind === "secondary")).toBe(true);
  });

  it("returns nothing for a target without a usable period", () => {
    const from = utcDate("2026-01-01", 0);
    const to = utcDate("2026-01-10", 0);
    expect(minimaTimesInRange({ epochJd, periodDays: 0 }, from, to)).toEqual([]);
  });
});