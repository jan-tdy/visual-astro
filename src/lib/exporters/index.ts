import { computeMagnitude, vsnetDate, meduzaDate, aavsoEstima, resolveCompValue, type ObsInput } from "@/lib/astro";

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
  return m.value;
}

function rowDate(row: ExportRow, ctx: ExportContext): Date {
  if (!row.ut_time) return ctx.observedAt;
  const m = String(row.ut_time).trim().match(/^(\d{1,2})[:.\s]+(\d{1,2})/);
  if (!m) return ctx.observedAt;
  const h = parseInt(m[1]), mm = parseInt(m[2]);
  const d = new Date(ctx.observedAt);
  d.setUTCHours(h, mm, 0, 0);
  // Časy 00:00–11:59 UT patria do nasledujúceho kalendárneho dňa
  // (pozorovanie cez polnoc), keďže session má dátum večera.
  if (h < 12) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
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
      ? (Number.isFinite(bVal) ? bVal.toFixed(2) : (r.limit_value ?? "").replace("<", ""))
      : (Number.isFinite(aVal) ? aVal.toFixed(2) : (r.a ?? ""));
    const comp2 = isLimit ? "na" : (Number.isFinite(bVal) ? bVal.toFixed(2) : (r.b ?? ""));
    const jd = ctx.jd + (rowDate(r, ctx).getTime() - ctx.observedAt.getTime()) / 86400000;
    const rawNote = (r.note ?? "").trim();
    const noteOut = rawNote.toUpperCase() === "OUTBURST" ? "Y" : (rawNote || "na");
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

export function buildMEDUZA(rows: ExportRow[], ctx: ExportContext): string {
  const dateStr = meduzaDate(ctx.observedAt);
  const lines: string[] = ["Estrella,JD,Mag,Fecha UT,Obs,Estima"];
  for (const r of rows) {
    const mag = magOrLimit(r);
    if (!mag) continue;
    lines.push(
      [r.star_name, ctx.jd.toFixed(3), mag, dateStr, ctx.obsCode, aavsoEstima(r)].join(","),
    );
  }
  return lines.join("\n") + "\n";
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