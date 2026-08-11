/** SIPS Standard photometry file parsing + VSNET/AAVSO builders (shared by the Tools page and MCP). */

/** Convert Julian Date to UTC Date (Meeus). */
export function sipsJdToDate(jd: number): Date {
  const J = jd + 0.5;
  const Z = Math.floor(J);
  const F = J - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayF = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayF);
  const dayFrac = dayF - day;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const totalSec = Math.round(dayFrac * 86400);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return new Date(Date.UTC(year, month - 1, day, h, m, s));
}

export function vsnetDateFromJD(jd: number): string {
  const d = sipsJdToDate(jd);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = d.getUTCDate();
  const frac = (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) / 24;
  const dayWithFrac = (day + frac).toFixed(3).padStart(6, "0");
  return `${y}${mo}${dayWithFrac}`;
}

/** Inverse of {@link vsnetDateFromJD}: parse a VSNET date token (YYYYMMDD.DDD, UT) into a Julian Date. */
export function vsnetDateToJD(token: string): number | null {
  const m = token.trim().match(/^(\d{4})(\d{2})(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const dayFrac = parseFloat(m[3]);
  if (month < 1 || month > 12 || dayFrac < 1 || dayFrac >= 32) return null;
  let y = year;
  let mo = month;
  if (mo <= 2) { y -= 1; mo += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + dayFrac + B - 1524.5;
}

export interface SipsRow { jd: number; mag: number; err: number }
export interface SipsParsed {
  rows: SipsRow[];
  varName: string | null;
  filter: string | null;
  errors: string[];
}

export function parseSIPS(
  text: string,
  msgs: { minCols: (line: number) => string; nonNumeric: (line: number) => string } = {
    minCols: (n) => `Line ${n}: at least 2 columns required`,
    nonNumeric: (n) => `Line ${n}: non-numeric JD or magnitude`,
  },
): SipsParsed {
  const rows: SipsRow[] = [];
  const errors: string[] = [];
  let varName: string | null = null;
  let filter: string | null = null;
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("#")) {
      const mVar = line.match(/VAR\s*Name\s*:\s*(.+?)\s*$/i);
      if (mVar) varName = mVar[1].trim();
      const mFil = line.match(/Filter\s*:\s*([^\s]+)/i);
      if (mFil) filter = mFil[1].trim();
      return;
    }
    const parts = line.split(/[\s,;]+/);
    if (parts.length < 2) { errors.push(msgs.minCols(i + 1)); return; }
    const jd = parseFloat(parts[0]);
    const mag = parseFloat(parts[1]);
    const err = parts.length >= 3 ? parseFloat(parts[2]) : NaN;
    if (!Number.isFinite(jd) || !Number.isFinite(mag)) {
      errors.push(msgs.nonNumeric(i + 1));
      return;
    }
    rows.push({ jd, mag, err: Number.isFinite(err) ? err : 0 });
  });
  return { rows, varName, filter, errors };
}

export function vsnetFilter(f: string | null): string {
  if (!f) return "C";
  const key = f.toUpperCase();
  const map: Record<string, string> = {
    V: "V", B: "B", R: "R", I: "I", U: "U",
    TR: "TR", TG: "TG", TB: "TB",
    CV: "CV", CR: "CR", CBB: "CBB",
    LPR: "CV", CLEAR: "C", CLR: "C", NONE: "C",
  };
  return map[key] ?? key;
}

export function buildVSNETFromSIPS(
  rows: SipsRow[],
  starCode: string,
  obsCode: string,
  filter: string | null,
): string {
  const code = starCode.trim().padEnd(8, " ");
  const obs = obsCode.trim();
  const filt = vsnetFilter(filter);
  const out: string[] = [];
  for (const r of rows) {
    const dateStr = vsnetDateFromJD(r.jd);
    const magStr = r.mag.toFixed(4).padStart(7, " ");
    out.push(`${code} ${dateStr} ${magStr} ${obs} ${filt}`);
  }
  return out.join("\n") + (out.length ? "\n" : "");
}

const AAVSO_FILTER_MAP: Record<string, string> = {
  V: "V", B: "B", R: "R", I: "I", U: "U",
  TR: "TR", TG: "TG", TB: "TB",
  CV: "CV", CR: "CR", CBB: "CBB",
  LPR: "CV",
  CLEAR: "CV", CLR: "CV", NONE: "CV",
};

export function aavsoFilter(f: string | null): string {
  if (!f) return "CV";
  const key = f.toUpperCase();
  return AAVSO_FILTER_MAP[key] ?? key;
}

export function buildAAVSOFromSIPS(
  rows: SipsRow[],
  aavsoCode: string,
  obsCode: string,
  filter: string | null,
  chartId: string,
): string {
  const header = [
    "#TYPE=Extended",
    `#OBSCODE=${obsCode.trim()}`,
    "#SOFTWARE=Visual-Astro (japysoft)",
    "#DELIM=,",
    "#DATE=JD",
    "#OBSTYPE=CCD",
  ].join("\n");
  const filt = aavsoFilter(filter);
  const chart = chartId.trim() || "na";
  const body: string[] = [];
  for (const r of rows) {
    body.push([
      aavsoCode.trim(),
      r.jd.toFixed(6),
      r.mag.toFixed(4),
      r.err > 0 ? r.err.toFixed(4) : "na",
      filt,
      "NO",
      "STD",
      "ENSEMBLE", "na", "na", "na",
      "na",
      "na",
      chart,
      "na",
    ].join(","));
  }
  return header + "\n" + body.join("\n") + "\n";
}

export interface VsnetRow {
  jd: number;
  mag: number;
  fainterThan: boolean;
  filter: string | null;
}

export interface VsnetParsed {
  rows: VsnetRow[];
  errors: string[];
}

/** Parse a VSNET-format observation file: `CODE YYYYMMDD.DDD MAG OBSCODE [FILTER]` per line. */
export function parseVSNET(
  text: string,
  msgs: { badLine: (line: number) => string } = {
    badLine: (n) => `Line ${n}: unrecognized VSNET row`,
  },
): VsnetParsed {
  const rows: VsnetRow[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(/\s+/);
    if (parts.length < 3) { errors.push(msgs.badLine(i + 1)); return; }
    const [, dateToken, magToken, , filterToken] = parts;
    const jd = vsnetDateToJD(dateToken);
    const fainterThan = magToken.startsWith("<");
    const mag = parseFloat(fainterThan ? magToken.slice(1) : magToken);
    if (jd == null || !Number.isFinite(mag)) { errors.push(msgs.badLine(i + 1)); return; }
    rows.push({ jd, mag, fainterThan, filter: filterToken ?? null });
  });
  return { rows, errors };
}

export function buildAAVSOFromVSNET(
  rows: VsnetRow[],
  aavsoCode: string,
  obsCode: string,
  chartId: string,
): string {
  const header = [
    "#TYPE=Extended",
    `#OBSCODE=${obsCode.trim()}`,
    "#SOFTWARE=Visual-Astro (japysoft)",
    "#DELIM=,",
    "#DATE=JD",
    "#OBSTYPE=CCD",
  ].join("\n");
  const chart = chartId.trim() || "na";
  const body: string[] = [];
  for (const r of rows) {
    const magStr = (r.fainterThan ? "<" : "") + r.mag.toFixed(4);
    body.push([
      aavsoCode.trim(),
      r.jd.toFixed(6),
      magStr,
      "na",
      aavsoFilter(r.filter),
      "NO",
      "STD",
      "ENSEMBLE", "na", "na", "na",
      "na",
      "na",
      chart,
      "na",
    ].join(","));
  }
  return header + "\n" + body.join("\n") + "\n";
}