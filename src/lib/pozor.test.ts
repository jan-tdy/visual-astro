import { describe, expect, it } from "vitest";
import * as Astronomy from "astronomy-engine";
import {
  altAz,
  airmass,
  dateToJD,
  duskTime,
  getLocation,
  helioCorrection,
  instantInfo,
  jdToDate,
  minimaTimesInRange,
  moonPhaseAt,
  sampleNight,
  sunAltitude,
  twilightTimes,
  utcDate,
} from "@/lib/pozor";

const piconcillo = getLocation("piconcillo");
const hlohovec = getLocation("hlohovec");
const kolonica = getLocation("kolonica");

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

describe("sampleNight span", () => {
  // Hlohovec is far enough north that sunset -> astronomical dusk lasts over two
  // hours in summer, so the chart window has to follow sunset/sunrise rather than
  // a fixed pad around darkness (issue #31).
  const cases: [string, ReturnType<typeof getLocation>, string][] = [
    ["2026-08-06", hlohovec, "summer at Hlohovec"],
    ["2026-06-21", hlohovec, "midsummer at Hlohovec"],
    ["2026-01-15", hlohovec, "winter at Hlohovec"],
    ["2026-08-06", piconcillo, "summer at Piconcillo"],
  ];

  for (const [date, loc, what] of cases) {
    it(`covers sunset through sunrise — ${what}`, () => {
      const { samples, twilight, fromDate, toDate } = sampleNight(date, loc, [], 10);
      expect(samples.length).toBeGreaterThan(0);
      expect(twilight.sunset).not.toBeNull();
      expect(twilight.sunrise).not.toBeNull();
      expect(fromDate.getTime()).toBeLessThan(twilight.sunset!.getTime());
      expect(toDate.getTime()).toBeGreaterThan(twilight.sunrise!.getTime());
      expect(samples[0].date.getTime()).toBe(fromDate.getTime());
      expect(samples[samples.length - 1].date.getTime()).toBeLessThanOrEqual(toDate.getTime());
    });
  }

  it("keeps the astronomical night inside the sampled span", () => {
    const { night, fromDate, toDate } = sampleNight("2026-08-06", hlohovec, [], 10);
    expect(night.start).not.toBeNull();
    expect(night.end).not.toBeNull();
    expect(night.start!.getTime()).toBeGreaterThan(fromDate.getTime());
    expect(night.end!.getTime()).toBeLessThan(toDate.getTime());
  });

  it("honours a custom pad on each side of the anchor", () => {
    const { twilight, fromDate, toDate } = sampleNight("2026-08-06", hlohovec, [], 10, {
      anchor: "sunset",
      padBeforeMinutes: 5,
      padAfterMinutes: 90,
    });
    expect(twilight.sunset!.getTime() - fromDate.getTime()).toBe(5 * 60e3);
    expect(toDate.getTime() - twilight.sunrise!.getTime()).toBe(90 * 60e3);
  });

  it("can anchor on astronomical darkness instead of sunset", () => {
    const { night, fromDate, toDate } = sampleNight("2026-08-06", hlohovec, [], 10, {
      anchor: "night",
      padBeforeMinutes: 5,
      padAfterMinutes: 5,
    });
    expect(night.start!.getTime() - fromDate.getTime()).toBe(5 * 60e3);
    expect(toDate.getTime() - night.end!.getTime()).toBe(5 * 60e3);
  });

  it("falls back to sunset when the chosen anchor never happens", () => {
    // Midsummer above the Arctic Circle: the Sun never reaches −18°, so an
    // astronomical-night anchor has nothing to hang off and must not produce an
    // empty chart.
    const arctic = { key: "arctic", label: "Arctic", lat: 69.65, lon: 18.96, elevation: 0 };
    const { samples } = sampleNight("2026-06-21", arctic, [], 30, {
      anchor: "night",
      padBeforeMinutes: 0,
      padAfterMinutes: 0,
    });
    expect(samples.length).toBeGreaterThan(0);
  });

  it("samples the target altitude at every step", () => {
    const { samples } = sampleNight(
      "2026-08-06",
      hlohovec,
      [{ key: "t", raHours: V2104AQL.raHours, decDeg: V2104AQL.decDeg }],
      30,
    );
    for (const s of samples) {
      expect(typeof s.targets.t).toBe("number");
      expect(s.targets.t).toBeGreaterThanOrEqual(-90);
      expect(s.targets.t).toBeLessThanOrEqual(90);
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

describe("duskTime", () => {
  it("matches astronomical dusk (-18°) when the Sun gets that low that night", () => {
    const tw = twilightTimes("2026-01-15", piconcillo);
    expect(tw.astroDusk).not.toBeNull();
    const d = duskTime("2026-01-15", piconcillo);
    expect(d).not.toBeNull();
    expect(Math.abs(d!.getTime() - tw.astroDusk!.getTime())).toBeLessThan(1000);
  });

  it("falls back to nautical dusk (-12°) when astronomical darkness never occurs", () => {
    // Kolonica (48.9°N) is far enough north that the Sun never reaches −18° around
    // the summer solstice.
    const tw = twilightTimes("2026-06-21", kolonica);
    expect(tw.astroDusk).toBeNull();
    expect(tw.nauticalDusk).not.toBeNull();
    const d = duskTime("2026-06-21", kolonica);
    expect(d).not.toBeNull();
    expect(Math.abs(d!.getTime() - tw.nauticalDusk!.getTime())).toBeLessThan(1000);
  });
});

describe("moonPhaseAt", () => {
  it("matches Astronomy.Illumination / Astronomy.MoonPhase directly", () => {
    const date = utcDate("2026-03-10", 20);
    const info = moonPhaseAt(date);
    const time = Astronomy.MakeTime(date);
    expect(info.pct).toBeCloseTo(Astronomy.Illumination(Astronomy.Body.Moon, time).phase_fraction * 100, 6);
    expect(info.angleDeg).toBeCloseTo(Astronomy.MoonPhase(time), 6);
  });

  it("stays within range and keeps waxing consistent with the phase angle", () => {
    for (const iso of ["2026-01-01", "2026-04-15", "2026-07-30", "2026-11-11"]) {
      const info = moonPhaseAt(utcDate(iso, 22));
      expect(info.pct).toBeGreaterThanOrEqual(0);
      expect(info.pct).toBeLessThanOrEqual(100);
      expect(info.angleDeg).toBeGreaterThanOrEqual(0);
      expect(info.angleDeg).toBeLessThan(360);
      expect(info.waxing).toBe(info.angleDeg < 180);
    }
  });
});