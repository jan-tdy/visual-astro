/**
 * POZOR — observability planner engine for CCD / photometry targets.
 *
 * Completely independent from the visual-observing catalogue (`stars`) and from
 * `src/lib/astro.ts` magnitude helpers. Target coordinates are stored as J2000
 * and precessed to the equinox of date before any altitude computation, which is
 * what the original Fortran POZOR program did.
 */
import * as Astronomy from "astronomy-engine";
import { dateToJD } from "./astro";

export const AU_KM = 1.495978707e8;
/** Light travel time for 1 AU, in seconds. */
export const LIGHT_TIME_AU_SEC = 499.004784;

export interface PozorLocation {
  key: string;
  label: string;
  /** Geodetic latitude, degrees north positive. */
  lat: number;
  /** Longitude, degrees EAST positive (west negative). */
  lon: number;
  /** Elevation above sea level, metres. */
  elevation: number;
}

export const POZOR_LOCATIONS: PozorLocation[] = [
  { key: "piconcillo", label: "Piconcillo", lat: 38.181, lon: -5.4591, elevation: 0 },
  { key: "kolonica", label: "Kolonica", lat: 48.935, lon: 22.2739, elevation: 0 },
  { key: "hlohovec", label: "Hlohovec", lat: 48.4202, lon: 17.7969, elevation: 0 },
  { key: "madeira", label: "Madeira", lat: 32.689, lon: -17.0919, elevation: 0 },
];

export const DEFAULT_LOCATION_KEY = "piconcillo";
export const DEFAULT_MIN_ALTITUDE = 30;

export function getLocation(key: string): PozorLocation {
  return POZOR_LOCATIONS.find((l) => l.key === key) ?? POZOR_LOCATIONS[0];
}

export function observerOf(loc: PozorLocation): Astronomy.Observer {
  return new Astronomy.Observer(loc.lat, loc.lon, loc.elevation);
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

/** Hours (0–24) → "18h12m22s". */
export function formatHMS(hours: number): string {
  let total = Math.round(((hours % 24) + 24) % 24 * 3600);
  if (total >= 86400) total -= 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total - h * 3600) / 60);
  const s = total - h * 3600 - m * 60;
  return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}

/** Degrees → "+60°21′05″". */
export function formatDMS(deg: number): string {
  const sign = deg < 0 ? "−" : "+";
  const a = Math.abs(deg);
  let total = Math.round(a * 3600);
  const d = Math.floor(total / 3600);
  const m = Math.floor((total - d * 3600) / 60);
  const s = total - d * 3600 - m * 60;
  return `${sign}${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″`;
}

/** "HH:MM" or "HH:MM:SS" of a Date, in UT. */
export function formatUT(d: Date | null, withSeconds = false): string {
  if (!d) return "—";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  if (!withSeconds) return `${hh}:${mm}`;
  return `${hh}:${mm}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
}

/** Parse "hh:mm" / "hh:mm:ss" / "hhmm" into fractional hours, or null. */
export function parseUtHours(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const m = /^(\d{1,2})[:.\s]?(\d{2})(?:[:.\s]?(\d{2}))?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  const se = m[3] ? Number(m[3]) : 0;
  if (h > 23 || mi > 59 || se > 59) return null;
  return h + mi / 60 + se / 3600;
}

/** Build a UTC Date from "YYYY-MM-DD" plus fractional hours. */
export function utcDate(isoDate: string, utHours = 0): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  const ms = Math.round(utHours * 3600 * 1000);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0) + ms);
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Julian Date                                                         */
/* ------------------------------------------------------------------ */

export { dateToJD };

/** Inverse of {@link dateToJD} — Julian Date → UTC Date (Meeus, ch. 7). */
export function jdToDate(jd: number): Date {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayF = b - d - Math.floor(30.6001 * e) + f;
  const day = Math.floor(dayF);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const msOfDay = Math.round((dayF - day) * 86400 * 1000);
  return new Date(Date.UTC(year, month - 1, day) + msOfDay);
}

/* ------------------------------------------------------------------ */
/* Coordinates                                                         */
/* ------------------------------------------------------------------ */

/** Unit vector in equatorial frame from RA (hours) / Dec (degrees). */
export function unitVector(raHours: number, decDeg: number): [number, number, number] {
  const ra = (raHours * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** Precess J2000 (EQJ) coordinates to the true equator of date (EQD). */
export function precessToDate(
  raHours: number,
  decDeg: number,
  date: Date,
): { raHours: number; decDeg: number } {
  const time = Astronomy.MakeTime(date);
  const [x, y, z] = unitVector(raHours, decDeg);
  const rot = Astronomy.Rotation_EQJ_EQD(time);
  const v = Astronomy.RotateVector(rot, new Astronomy.Vector(x, y, z, time));
  const r = Math.hypot(v.x, v.y, v.z);
  const ra = (Math.atan2(v.y, v.x) * 180) / Math.PI / 15;
  const dec = (Math.asin(v.z / r) * 180) / Math.PI;
  return { raHours: ((ra % 24) + 24) % 24, decDeg: dec };
}

/** Local mean/apparent sidereal time in hours (0–24). */
export function localSiderealTime(date: Date, loc: PozorLocation): number {
  const gast = Astronomy.SiderealTime(Astronomy.MakeTime(date));
  return ((gast + loc.lon / 15) % 24 + 24) % 24;
}

export interface AltAz {
  /** Geometric (unrefracted) altitude, degrees. */
  altDeg: number;
  /** Azimuth, degrees east of north. */
  azDeg: number;
  /** Hour angle, hours 0–24. */
  haHours: number;
  lstHours: number;
  raOfDate: number;
  decOfDate: number;
}

/** Altitude/azimuth of a J2000 target as seen from `loc` at `date`. */
export function altAz(raHoursJ2000: number, decDegJ2000: number, date: Date, loc: PozorLocation): AltAz {
  const { raHours, decDeg } = precessToDate(raHoursJ2000, decDegJ2000, date);
  const lst = localSiderealTime(date, loc);
  const ha = ((lst - raHours) % 24 + 24) % 24;
  const H = (ha * 15 * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const lat = (loc.lat * Math.PI) / 180;
  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
  const altDeg = (Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180) / Math.PI;
  const az =
    (Math.atan2(
      -Math.cos(dec) * Math.sin(H),
      Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H),
    ) *
      180) /
    Math.PI;
  return { altDeg, azDeg: (az + 360) % 360, haHours: ha, lstHours: lst, raOfDate: raHours, decOfDate: decDeg };
}

/** Plane-parallel air mass (sec z). Returns null below the horizon. */
export function airmass(altDeg: number): number | null {
  if (altDeg <= 0) return null;
  return 1 / Math.sin((altDeg * Math.PI) / 180);
}

/* ------------------------------------------------------------------ */
/* Heliocentric correction                                             */
/* ------------------------------------------------------------------ */

export interface HelioCorrection {
  /** JD_hel − JD, in days. */
  days: number;
  /** Projection of Earth's heliocentric velocity onto the line of sight, km/s. */
  rvKmS: number;
}

/**
 * Heliocentric timing correction for a target: JD_hel = JD + (r⃗_Earth,helio · ŝ)/c,
 * where ŝ is the unit vector towards the star. Also returns the radial-velocity
 * projection of Earth's orbital motion (positive = Earth receding from the star).
 */
export function helioCorrection(raHoursJ2000: number, decDegJ2000: number, date: Date): HelioCorrection {
  const time = Astronomy.MakeTime(date);
  const state = Astronomy.HelioState(Astronomy.Body.Earth, time);
  const s = unitVector(raHoursJ2000, decDegJ2000);
  const dotAu = state.x * s[0] + state.y * s[1] + state.z * s[2];
  const dotVel = state.vx * s[0] + state.vy * s[1] + state.vz * s[2]; // AU/day
  return {
    days: (dotAu * LIGHT_TIME_AU_SEC) / 86400,
    rvKmS: (dotVel * AU_KM) / 86400,
  };
}

/* ------------------------------------------------------------------ */
/* Full instant info                                                   */
/* ------------------------------------------------------------------ */

export interface InstantInfo {
  date: Date;
  jd: number;
  jdHel: number;
  helCorrDays: number;
  rvKmS: number;
  lstHours: number;
  haHours: number;
  altDeg: number;
  azDeg: number;
  airmass: number | null;
  raOfDate: number;
  decOfDate: number;
}

export function instantInfo(
  raHoursJ2000: number,
  decDegJ2000: number,
  date: Date,
  loc: PozorLocation,
): InstantInfo {
  const pos = altAz(raHoursJ2000, decDegJ2000, date, loc);
  const jd = dateToJD(date);
  const hc = helioCorrection(raHoursJ2000, decDegJ2000, date);
  return {
    date,
    jd,
    jdHel: jd + hc.days,
    helCorrDays: hc.days,
    rvKmS: hc.rvKmS,
    lstHours: pos.lstHours,
    haHours: pos.haHours,
    altDeg: pos.altDeg,
    azDeg: pos.azDeg,
    airmass: airmass(pos.altDeg),
    raOfDate: pos.raOfDate,
    decOfDate: pos.decOfDate,
  };
}

/* ------------------------------------------------------------------ */
/* Night & Moon                                                        */
/* ------------------------------------------------------------------ */

export interface NightInfo {
  /** Calendar date of the evening the night starts (ISO). */
  isoDate: string;
  /** Astronomical twilight end (Sun reaches −18°), or null if it never gets dark. */
  start: Date | null;
  /** Astronomical twilight begin next morning (Sun back to −18°), or null. */
  end: Date | null;
  moonRise: Date | null;
  moonSet: Date | null;
  /** Illuminated fraction in percent, at local midnight of the night. */
  moonPhasePercent: number;
  /** Moon phase angle 0–360° (0 = new, 180 = full). */
  moonPhaseAngle: number;
}

/** Astronomical night for the evening of `isoDate` at `loc`. */
export function nightInfo(isoDate: string, loc: PozorLocation, sunAltDeg = -18): NightInfo {
  const observer = observerOf(loc);
  // Anchor at local noon so we always pick the following evening's darkness.
  const noonLocal = utcDate(isoDate, 12 - loc.lon / 15);
  let start: Date | null = null;
  let end: Date | null = null;
  try {
    const s = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, noonLocal, 1, sunAltDeg);
    start = s ? s.date : null;
    const e = Astronomy.SearchAltitude(
      Astronomy.Body.Sun,
      observer,
      +1,
      start ?? noonLocal,
      1,
      sunAltDeg,
    );
    end = e ? e.date : null;
  } catch {
    start = null;
    end = null;
  }
  const midnight = utcDate(isoDate, 24 - loc.lon / 15);
  let moonRise: Date | null = null;
  let moonSet: Date | null = null;
  try {
    const r = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, +1, noonLocal, 1);
    moonRise = r ? r.date : null;
    const st = Astronomy.SearchRiseSet(Astronomy.Body.Moon, observer, -1, noonLocal, 1);
    moonSet = st ? st.date : null;
  } catch {
    /* circumpolar / no event */
  }
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, midnight);
  return {
    isoDate,
    start,
    end,
    moonRise,
    moonSet,
    moonPhasePercent: illum.phase_fraction * 100,
    moonPhaseAngle: Astronomy.MoonPhase(midnight),
  };
}

/** Moon altitude in degrees (geometric centre) at `date`. */
export function moonAltitude(date: Date, loc: PozorLocation): number {
  const time = Astronomy.MakeTime(date);
  const observer = observerOf(loc);
  const eq = Astronomy.Equator(Astronomy.Body.Moon, time, observer, true, true);
  const hor = Astronomy.Horizon(time, observer, eq.ra, eq.dec, "normal");
  return hor.altitude;
}

/** Sun altitude in degrees at `date`. */
export function sunAltitude(date: Date, loc: PozorLocation): number {
  const time = Astronomy.MakeTime(date);
  const observer = observerOf(loc);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const hor = Astronomy.Horizon(time, observer, eq.ra, eq.dec, "normal");
  return hor.altitude;
}

/* ------------------------------------------------------------------ */
/* Twilight crossing times                                             */
/* ------------------------------------------------------------------ */

export interface TwilightTimes {
  /** Sunset (Sun alt 0°), evening. */
  sunset: Date | null;
  /** Civil dusk (Sun alt −6°), evening. */
  civilDusk: Date | null;
  /** Nautical dusk (Sun alt −12°), evening. */
  nauticalDusk: Date | null;
  /** Astronomical dusk (Sun alt −18°), evening. */
  astroDusk: Date | null;
  /** Astronomical dawn (Sun alt −18°), morning. */
  astroDawn: Date | null;
  /** Nautical dawn (Sun alt −12°), morning. */
  nauticalDawn: Date | null;
  /** Civil dawn (Sun alt −6°), morning. */
  civilDawn: Date | null;
  /** Sunrise (Sun alt 0°), morning. */
  sunrise: Date | null;
}

/**
 * Evening/morning instants when the Sun crosses 0°, −6°, −12° and −18°
 * altitude (sunset/sunrise, civil, nautical and astronomical twilight) for
 * the night of `isoDate` at `loc`.
 */
export function twilightTimes(isoDate: string, loc: PozorLocation): TwilightTimes {
  const observer = observerOf(loc);
  const noonLocal = utcDate(isoDate, 12 - loc.lon / 15);
  const search = (dir: -1 | 1, altDeg: number, start: Date): Date | null => {
    try {
      const r = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, dir, start, 1, altDeg);
      return r ? r.date : null;
    } catch {
      return null;
    }
  };
  const sunset = search(-1, 0, noonLocal);
  const civilDusk = search(-1, -6, sunset ?? noonLocal);
  const nauticalDusk = search(-1, -12, civilDusk ?? noonLocal);
  const astroDusk = search(-1, -18, nauticalDusk ?? noonLocal);
  const astroDawn = search(+1, -18, astroDusk ?? noonLocal);
  const nauticalDawn = search(+1, -12, astroDawn ?? noonLocal);
  const civilDawn = search(+1, -6, nauticalDawn ?? noonLocal);
  const sunrise = search(+1, 0, civilDawn ?? noonLocal);
  return { sunset, civilDusk, nauticalDusk, astroDusk, astroDawn, nauticalDawn, civilDawn, sunrise };
}

/* ------------------------------------------------------------------ */
/* Night sampling & observability windows                              */
/* ------------------------------------------------------------------ */

export interface NightSample {
  date: Date;
  /** Minutes since the sampling start (used for the chart X axis). */
  minutes: number;
  utHours: number;
  sunAlt: number;
  moonAlt: number;
  /** target key → altitude in degrees */
  targets: Record<string, number>;
}

export interface SampleTarget {
  key: string;
  raHours: number;
  decDeg: number;
}

/**
 * Sample altitudes across the whole night, from sunset to sunrise (plus a small
 * padding margin on both sides so the sunset/sunrise boundaries stay visible on
 * the chart).
 *
 * The span must be anchored on sunset/sunrise rather than on astronomical
 * darkness: the gap between the two grows with latitude and towards midsummer
 * (~2h at Hlohovec in August, ~4h in June), so a fixed pad around astronomical
 * night would push sunset and sunrise off the chart entirely.
 */
export function sampleNight(
  isoDate: string,
  loc: PozorLocation,
  targets: SampleTarget[],
  stepMinutes = 10,
  padMinutes = 30,
): {
  samples: NightSample[];
  night: NightInfo;
  twilight: TwilightTimes;
  fromDate: Date;
  toDate: Date;
} {
  const night = nightInfo(isoDate, loc);
  const tw = twilightTimes(isoDate, loc);
  const localNoon = utcDate(isoDate, 12 - loc.lon / 15).getTime();
  // Fall back to astronomical darkness, then to a fixed evening-to-morning slot,
  // for places/dates where the Sun never crosses the horizon at all.
  const fromAnchor = tw.sunset ?? night.start ?? new Date(localNoon + 6 * 3600e3);
  const toAnchor = tw.sunrise ?? night.end ?? new Date(localNoon + 18 * 3600e3);
  const from = fromAnchor.getTime() - padMinutes * 60e3;
  const to = toAnchor.getTime() + padMinutes * 60e3;
  const samples: NightSample[] = [];
  for (let t = from; t <= to; t += stepMinutes * 60e3) {
    const d = new Date(t);
    const row: NightSample = {
      date: d,
      minutes: Math.round((t - from) / 60e3),
      utHours: d.getUTCHours() + d.getUTCMinutes() / 60,
      sunAlt: sunAltitude(d, loc),
      moonAlt: moonAltitude(d, loc),
      targets: {},
    };
    for (const tg of targets) {
      row.targets[tg.key] = altAz(tg.raHours, tg.decDeg, d, loc).altDeg;
    }
    samples.push(row);
  }
  return { samples, night, twilight: tw, fromDate: new Date(from), toDate: new Date(to) };
}

export interface Window {
  from: Date;
  to: Date;
}

/**
 * Interval(s) during the astronomical night when the target stays above
 * `minAltDeg`. Scanned at 1-minute resolution.
 */
export function observabilityWindows(
  raHours: number,
  decDeg: number,
  night: NightInfo,
  loc: PozorLocation,
  minAltDeg = DEFAULT_MIN_ALTITUDE,
): Window[] {
  if (!night.start || !night.end) return [];
  const step = 60e3;
  const out: Window[] = [];
  let openFrom: Date | null = null;
  for (let t = night.start.getTime(); t <= night.end.getTime(); t += step) {
    const d = new Date(t);
    const above = altAz(raHours, decDeg, d, loc).altDeg >= minAltDeg;
    if (above && !openFrom) openFrom = d;
    if (!above && openFrom) {
      out.push({ from: openFrom, to: new Date(t - step) });
      openFrom = null;
    }
  }
  if (openFrom) out.push({ from: openFrom, to: night.end });
  return out;
}

/* ------------------------------------------------------------------ */
/* Minima                                                              */
/* ------------------------------------------------------------------ */

export interface MinimumEvent {
  epoch: number;
  jd: number;
  jdHel: number;
  helCorrDays: number;
  date: Date;
  altDeg: number;
  airmass: number | null;
  duringNight: boolean;
  aboveMinAlt: boolean;
}

/**
 * All minima of an eclipsing target between two dates.
 * E = round((JD − JD0)/P), Tmin = JD0 + E·P.
 */
export function minimaInRange(
  target: { raHours: number; decDeg: number; epochJd: number; periodDays: number },
  fromIso: string,
  toIso: string,
  loc: PozorLocation,
  minAltDeg = DEFAULT_MIN_ALTITUDE,
  onlyObservable = true,
): MinimumEvent[] {
  const { epochJd, periodDays } = target;
  if (!periodDays || periodDays <= 0) return [];
  const jdFrom = dateToJD(utcDate(fromIso, 0));
  const jdTo = dateToJD(utcDate(toIso, 24));
  const eStart = Math.ceil((jdFrom - epochJd) / periodDays);
  const eEnd = Math.floor((jdTo - epochJd) / periodDays);
  if (eEnd - eStart > 200000) return [];

  // Cache night boundaries per calendar date — nightInfo is relatively expensive.
  const nights = new Map<string, NightInfo>();
  const nightFor = (d: Date): NightInfo => {
    // A night is labelled by the evening it began: before local noon we belong to
    // the previous evening.
    const localHours = d.getUTCHours() + d.getUTCMinutes() / 60 + loc.lon / 15;
    const anchor = new Date(d.getTime());
    if (localHours < 12) anchor.setUTCDate(anchor.getUTCDate() - 1);
    const iso = toIsoDate(anchor);
    let n = nights.get(iso);
    if (!n) {
      n = nightInfo(iso, loc);
      nights.set(iso, n);
    }
    return n;
  };

  const out: MinimumEvent[] = [];
  for (let e = eStart; e <= eEnd; e++) {
    const jd = epochJd + e * periodDays;
    const date = jdToDate(jd);
    const info = instantInfo(target.raHours, target.decDeg, date, loc);
    const night = nightFor(date);
    const duringNight =
      !!night.start && !!night.end && date >= night.start && date <= night.end;
    const aboveMinAlt = info.altDeg >= minAltDeg;
    if (onlyObservable && !(duringNight && aboveMinAlt)) continue;
    out.push({
      epoch: e,
      jd,
      jdHel: info.jdHel,
      helCorrDays: info.helCorrDays,
      date,
      altDeg: info.altDeg,
      airmass: info.airmass,
      duringNight,
      aboveMinAlt,
    });
  }
  return out;
}

export interface MinimumTime {
  epoch: number;
  date: Date;
  kind: "primary" | "secondary";
}

/**
 * Primary (phase 0) and secondary (phase 0.5, circular-orbit assumption)
 * minima of an eclipsing target that fall inside [`fromDate`, `toDate`] —
 * unfiltered by observability, purely epoch/period arithmetic.
 */
export function minimaTimesInRange(
  target: { epochJd: number; periodDays: number },
  fromDate: Date,
  toDate: Date,
): MinimumTime[] {
  const { epochJd, periodDays } = target;
  if (!periodDays || periodDays <= 0) return [];
  const jdFrom = dateToJD(fromDate);
  const jdTo = dateToJD(toDate);
  const out: MinimumTime[] = [];
  for (const [kind, offset] of [
    ["primary", 0],
    ["secondary", 0.5],
  ] as const) {
    const eStart = Math.floor((jdFrom - epochJd) / periodDays - offset);
    const eEnd = Math.ceil((jdTo - epochJd) / periodDays - offset);
    for (let e = eStart; e <= eEnd; e++) {
      const jd = epochJd + (e + offset) * periodDays;
      if (jd < jdFrom || jd > jdTo) continue;
      out.push({ epoch: e, date: jdToDate(jd), kind });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Journal                                                             */
/* ------------------------------------------------------------------ */

export interface JournalRow {
  isoDate: string;
  weekday: number;
  jdMidnight: number;
  night: NightInfo;
  windows: Window[];
  /** Heliocentric phase at the edges of the first window (eclipsing targets). */
  phaseFrom: number | null;
  phaseTo: number | null;
  altMax: number;
}

export function heliocentricPhase(
  date: Date,
  target: { raHours: number; decDeg: number; epochJd: number | null; periodDays: number | null },
): number | null {
  if (!target.epochJd || !target.periodDays || target.periodDays <= 0) return null;
  const jd = dateToJD(date);
  const jdHel = jd + helioCorrection(target.raHours, target.decDeg, date).days;
  const p = ((jdHel - target.epochJd) / target.periodDays) % 1;
  return p < 0 ? p + 1 : p;
}

export function buildJournal(
  target: { raHours: number; decDeg: number; epochJd: number | null; periodDays: number | null },
  fromIso: string,
  toIso: string,
  loc: PozorLocation,
  minAltDeg = DEFAULT_MIN_ALTITUDE,
  maxNights = 400,
): JournalRow[] {
  const rows: JournalRow[] = [];
  let cur = utcDate(fromIso, 0);
  const end = utcDate(toIso, 0);
  while (cur <= end && rows.length < maxNights) {
    const iso = toIsoDate(cur);
    const night = nightInfo(iso, loc);
    const windows = observabilityWindows(target.raHours, target.decDeg, night, loc, minAltDeg);
    let altMax = -90;
    if (night.start && night.end) {
      for (let t = night.start.getTime(); t <= night.end.getTime(); t += 10 * 60e3) {
        const a = altAz(target.raHours, target.decDeg, new Date(t), loc).altDeg;
        if (a > altMax) altMax = a;
      }
    }
    rows.push({
      isoDate: iso,
      weekday: cur.getUTCDay(),
      jdMidnight: dateToJD(utcDate(iso, 0)),
      night,
      windows,
      phaseFrom: windows[0] ? heliocentricPhase(windows[0].from, target) : null,
      phaseTo: windows[0] ? heliocentricPhase(windows[0].to, target) : null,
      altMax,
    });
    cur = new Date(cur.getTime() + 86400e3);
  }
  return rows;
}