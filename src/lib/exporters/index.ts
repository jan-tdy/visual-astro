import { computeMagnitude, vsnetDate, meduzaDate, aavsoEstima, type ObsInput } from "@/lib/astro";

export interface ExportRow extends ObsInput {
  star_name: string;
  vsnet_code?: string | null;
  aavso_code?: string | null;
  chart_id?: string | null;
  note?: string | null;
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

export function buildVSNET(rows: ExportRow[], ctx: ExportContext): string {
  const dateStr = vsnetDate(ctx.observedAt);
  const lines: string[] = [];
  for (const r of rows) {
    const mag = magOrLimit(r);
    if (!mag) continue;
    if (!r.vsnet_code) continue;
    const code = r.vsnet_code.trim().padEnd(8, " ");
    lines.push(`${code} ${dateStr} ${mag.padStart(5, " ")} ${ctx.obsCode}`);
  }
  return lines.join("\n") + "\n";
}

export function buildAAVSO(rows: ExportRow[], ctx: ExportContext): string {
  const header = [
    "#TYPE=Visual",
    `#OBSCODE=${ctx.obsCode}`,
    "#SOFTWARE=Reducciones (Lovable)",
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
    const comp1 = isLimit ? (r.b ? r.b.replace("<", "") : (r.limit_value ?? "").replace("<", "")) : (r.a ?? "");
    const comp2 = isLimit ? "na" : (r.b ?? "");
    body.push(
      [
        r.aavso_code,
        ctx.jd.toFixed(4),
        mag,
        "na",
        comp1 || "na",
        comp2 || "na",
        r.chart_id || "na",
        r.note || "na",
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