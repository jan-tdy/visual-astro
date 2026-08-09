import { applyUtTimeToDate, computeMagnitude, vsnetDate, resolveCompValue, type ObsInput } from "../astro";

export interface ExportRow extends ObsInput {
  star_name: string;
  vsnet_code?: string | null;
  aavso_code?: string | null;
  chart_id?: string | null;
  note?: string | null;
  ut_time?: string | null;
}

export interface ExportContext {
  observedAt: Date;
  jd: number;
  obsCode: string;
}

function magOrLimit(r: ExportRow): string | null {
  const m = computeMagnitude(r, r.star_name);
  // A "fainter-than" value is the user's raw limit_value text, so it needs the same
  // CSV-delimiter guard as the other free-text fields below.
  return m.value == null ? null : csvSafe(m.value);
}

/**
 * Guard user free text (notes, star names) against the CSV delimiter — the AAVSO
 * export is unquoted comma-separated, so a stray comma would silently shift columns.
 */
function csvSafe(s: string): string {
  return s.replace(/[,\r\n]/g, " ").trim();
}

function rowDate(row: ExportRow, ctx: ExportContext): Date {
  if (!row.ut_time) return ctx.observedAt;
  const d = new Date(ctx.observedAt);
  applyUtTimeToDate(d, row.ut_time);
  return d;
}

export function buildVSNET(rows: ExportRow[], ctx: ExportContext): string {
  const lines: string[] = [];
  for (const r of rows) {
    const mag = magOrLimit(r);
    if (!mag) continue;
    if (!r.vsnet_code) continue;
    const code = r.vsnet_code.trim().padEnd(8, " ");
    const dateStr = vsnetDate(rowDate(r, ctx));
    const rawNote = (r.note ?? "").trim();
    const suffix = rawNote ? ` ${rawNote}` : "";
    lines.push(`${code} ${dateStr} ${mag.padStart(5, " ")} ${ctx.obsCode}${suffix}`);
  }
  return lines.join("\n") + "\n";
}

export function buildAAVSO(rows: ExportRow[], ctx: ExportContext): string {
  const header = [
    "#TYPE=Visual",
    `#OBSCODE=${ctx.obsCode}`,
    "#SOFTWARE=Visual-Astro (japysoft)",
    "#DELIM=,",
    "#DATE=JD",
    "#OBSTYPE=Visual",
  ].join("\n");
  const body: string[] = [];
  for (const r of rows) {
    const mag = magOrLimit(r);
    if (!mag) continue;
    if (!r.aavso_code) continue;
    const isLimit = !!(r.limit_value && r.limit_value.trim());
    // Resolve A/B (which may be a letter) to numeric magnitudes for the AAVSO comp fields.
    const aVal = resolveCompValue(r.star_name, r.a ?? null);
    const bVal = resolveCompValue(r.star_name, r.b ?? null);
    const comp1 = isLimit
      ? (Number.isFinite(bVal) ? bVal.toFixed(2) : csvSafe((r.limit_value ?? "").replace("<", "")))
      : (Number.isFinite(aVal) ? aVal.toFixed(2) : csvSafe(r.a ?? ""));
    const comp2 = isLimit ? "na" : (Number.isFinite(bVal) ? bVal.toFixed(2) : csvSafe(r.b ?? ""));
    const jd = ctx.jd + (rowDate(r, ctx).getTime() - ctx.observedAt.getTime()) / 86400000;
    const rawNote = csvSafe((r.note ?? "").trim().replace(/:/g, "Z"));
    const upper = rawNote.toUpperCase();
    const noteOut = upper === "OUTBURST" || upper === "ACTIVE" ? "Y" : (rawNote || "na");
    body.push(
      [
        r.aavso_code,
        jd.toFixed(4),
        mag,
        "na",
        comp1 || "na",
        comp2 || "na",
        r.chart_id || "na",
        noteOut,
      ].join(","),
    );
  }
  return header + "\n" + body.join("\n") + "\n";
}

function padNum(n: number, width: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(width, "0");
}

function utClock(v: string): { h: number; m: number } | null {
  const m = String(v).match(/(\d{1,2})[:.\s]+(\d{1,2})/);
  if (!m) return null;
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10) };
}

export interface SessionSummaryContext {
  obsCode: string;
}

// Guards an outburst star name against the summary's own field/list delimiters
// (comma separates fields, ";" separates star names, "[]" wraps the list).
function sanitizeStarName(s: string): string {
  return s.replace(/[[\];,]/g, " ").trim();
}

/**
 * A copyable one-line recap of the session: observer code + observation count,
 * start/end UT (crossing midnight is flagged "nxtday"), counts of rows noted
 * OUTBURST / ACTIVE, and — when any row is noted OUTBURST — the distinct star
 * names in outburst, appended in brackets and separated by ";".
 * e.g. "DPV-26, start2300ut, end-0200utnxtday, outburst-0002[T CrB;U Sco], active-0001".
 */
export function buildExportSummary(rows: ExportRow[], ctx: SessionSummaryContext): string {
  const clocks = rows
    .map((r) => (r.ut_time ? utClock(r.ut_time) : null))
    .filter((c): c is { h: number; m: number } => c !== null);

  let startStr = "0000";
  let endStr = "0000";
  let nextDay = false;
  if (clocks.length > 0) {
    // Same "post-midnight rolls to next day" convention as the export row sort in
    // SessionEditor: hours before noon belong to the tail end of the observing night.
    const withKey = clocks.map((c) => ({ c, key: (c.h < 12 ? c.h + 24 : c.h) * 60 + c.m }));
    withKey.sort((a, b) => a.key - b.key);
    const start = withKey[0].c;
    const end = withKey[withKey.length - 1].c;
    startStr = `${padNum(start.h, 2)}${padNum(start.m, 2)}`;
    endStr = `${padNum(end.h, 2)}${padNum(end.m, 2)}`;
    nextDay = end.h < start.h;
  }

  let outburst = 0;
  let active = 0;
  const outburstStars: string[] = [];
  for (const r of rows) {
    const note = (r.note ?? "").trim().toUpperCase();
    if (note === "OUTBURST") {
      outburst++;
      const name = sanitizeStarName(r.star_name ?? "");
      if (name && !outburstStars.includes(name)) outburstStars.push(name);
    } else if (note === "ACTIVE") active++;
  }
  const outburstField = outburstStars.length
    ? `outburst-${padNum(outburst, 4)}[${outburstStars.join(";")}]`
    : `outburst-${padNum(outburst, 4)}`;

  return [
    `${ctx.obsCode.toUpperCase()}-${rows.length}`,
    `start${startStr}ut`,
    `end-${endStr}ut${nextDay ? "nxtday" : ""}`,
    outburstField,
    `active-${padNum(active, 4)}`,
  ].join(", ");
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}