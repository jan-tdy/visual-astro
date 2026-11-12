/**
 * Catalog import converter, ported from useless-astro's catalog-import.astro: takes a
 * pasted/uploaded delimited target list in any column order and produces a CSV in the
 * `name,ra,dec,type,note` shape (RA as HH:MM:SS, Dec as ±DD:MM:SS) that japyscope-remote's
 * catalog importer expects.
 */

export type Delimiter = "auto" | "comma" | "tab" | "semicolon" | "ws";
export type ColumnRole = "ignore" | "name" | "ra" | "dec" | "type" | "note";
export type CoordFormat = "sex" | "deg" | "hour";

/** Parse one CSV line, honoring double-quoted fields with "" as an escaped quote. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function splitLine(line: string, delim: Exclude<Delimiter, "auto">): string[] {
  if (delim === "comma") return parseCsvLine(line);
  if (delim === "tab") return line.split("\t").map((s) => s.trim());
  if (delim === "semicolon") return line.split(";").map((s) => s.trim());
  return line.trim().split(/\s+/);
}

export function detectDelimiter(lines: string[]): Exclude<Delimiter, "auto"> {
  if (lines.some((l) => l.includes("\t"))) return "tab";
  if (lines.some((l) => l.includes(","))) return "comma";
  if (lines.some((l) => l.includes(";"))) return "semicolon";
  return "ws";
}

/** Parse a sexagesimal coordinate string (any of "12 34 56", "12:34:56", "12h34m56s", "-05 23"). */
export function parseSexagesimalLoose(str: string | null | undefined): number | null {
  if (!str) return null;
  let s = String(str).trim();
  let sign = 1;
  if (s.startsWith("-")) { sign = -1; s = s.slice(1); }
  else if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/[hHmM°'′]/g, " ").replace(/[sS"″]/g, "");
  const parts = s.trim().split(/[:\s]+/).filter(Boolean);
  if (parts.length === 0) return null;
  const d = Number(parts[0]);
  if (Number.isNaN(d)) return null;
  const m = parts[1] !== undefined ? Number(parts[1]) : 0;
  const sec = parts[2] !== undefined ? Number(parts[2]) : 0;
  if (Number.isNaN(m) || Number.isNaN(sec)) return null;
  return sign * (Math.abs(d) + m / 60 + sec / 3600);
}

/** Parse an RA value in the given format into decimal hours (0-24). */
export function parseRa(raw: string | undefined, format: CoordFormat): number | null {
  if (format === "sex") return parseSexagesimalLoose(raw);
  const v = Number(raw);
  if (Number.isNaN(v)) return null;
  return format === "deg" ? v / 15 : v;
}

/** Parse a Dec value in the given format into decimal degrees. */
export function parseDec(raw: string | undefined, format: Exclude<CoordFormat, "hour">): number | null {
  if (format === "sex") return parseSexagesimalLoose(raw);
  const v = Number(raw);
  return Number.isNaN(v) ? null : v;
}

function pad(n: number, width: number): string {
  return String(Math.floor(n)).padStart(width, "0");
}

/** Format decimal RA hours as HH:MM:SS, wrapping into [0, 24). */
export function formatRaHMS(hoursDecimal: number): string {
  const hours = ((hoursDecimal % 24) + 24) % 24;
  const h = Math.floor(hours);
  const mFull = (hours - h) * 60;
  const m = Math.floor(mFull);
  let s = Math.round((mFull - m) * 60);
  let hh = h, mm = m;
  if (s === 60) { s = 0; mm += 1; }
  if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
  return `${pad(hh, 2)}:${pad(mm, 2)}:${pad(s, 2)}`;
}

/** Format decimal Dec degrees as ±DD:MM:SS, clamped to [-90, 90]. */
export function formatDecDMS(degDecimal: number): string {
  const deg = Math.min(90, Math.max(-90, degDecimal));
  const sign = deg < 0 ? "-" : "+";
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFull = (abs - d) * 60;
  const m = Math.floor(mFull);
  let s = Math.round((mFull - m) * 60);
  let dd = d, mm = m;
  if (s === 60) { s = 0; mm += 1; }
  if (mm === 60) { mm = 0; dd += 1; }
  return `${sign}${pad(dd, 2)}:${pad(mm, 2)}:${pad(s, 2)}`;
}

/** Quote a CSV field only if it needs it (contains a comma, quote or newline). */
export function csvField(value: string | null | undefined): string {
  const v = value == null ? "" : String(value);
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Guess a column's role from its header text, falling back to position for common shapes. */
export function guessRole(headerText: string, colIndex: number, colCount: number): ColumnRole {
  const h = (headerText || "").toLowerCase();
  if (/name|designation|star|object|id/.test(h)) return "name";
  if (/^ra$|right\s*asc/.test(h)) return "ra";
  if (/^dec|declin/.test(h)) return "dec";
  if (/type|class/.test(h)) return "type";
  if (/note|comment|remark/.test(h)) return "note";
  if (!headerText) {
    if (colCount >= 5) return (["name", "ra", "dec", "type", "note"] as ColumnRole[])[colIndex] ?? "ignore";
    if (colCount === 3) return (["name", "ra", "dec"] as ColumnRole[])[colIndex] ?? "ignore";
  }
  return "ignore";
}

/** Guess whether a sample coordinate value is sexagesimal or a plain decimal number. */
export function guessCoordFormat(sampleValue: string): CoordFormat {
  if (!sampleValue) return "sex";
  const trimmed = sampleValue.trim();
  return /[:hms\s]/i.test(trimmed) && /\d\s*[:hms\s]\s*\d/i.test(trimmed) ? "sex" : "deg";
}

export interface ColumnMapping {
  role: ColumnRole;
  format?: CoordFormat;
}

export interface CatalogRow {
  name: string;
  ra: string;
  dec: string;
  type: string;
  note: string;
}

export interface ConvertResult {
  rows: CatalogRow[];
  warnings: string[];
}

/** Convert raw split data rows into japyscope-remote's catalog CSV shape, given a role/format
 *  mapping per column index. Rows with no name are dropped silently (matching the original tool). */
export function convertCatalogRows(
  dataRows: string[][],
  mapping: Record<number, ColumnMapping>,
  appendIgnored: boolean,
): ConvertResult {
  const entries = Object.entries(mapping);
  const nameCol = entries.find(([, m]) => m.role === "name")?.[0];
  const raCol = entries.find(([, m]) => m.role === "ra")?.[0];
  const decCol = entries.find(([, m]) => m.role === "dec")?.[0];
  const typeCol = entries.find(([, m]) => m.role === "type")?.[0];
  const noteCol = entries.find(([, m]) => m.role === "note")?.[0];
  const ignoredCols = entries.filter(([, m]) => m.role === "ignore").map(([k]) => k);

  if (nameCol === undefined) {
    return { rows: [], warnings: ['Map at least one column to "Name".'] };
  }

  const rows: CatalogRow[] = [];
  const warnings: string[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 1;
    const name = (row[Number(nameCol)] || "").trim();
    if (!name) return;
    if (name.length > 120) warnings.push(`Row ${rowNum}: name is over 120 characters and will be rejected by japyscope-remote.`);

    let raOut = "";
    if (raCol !== undefined) {
      const format = (mapping[Number(raCol)].format ?? "sex") as CoordFormat;
      const h = parseRa(row[Number(raCol)], format);
      if (h === null) warnings.push(`Row ${rowNum} (${name}): could not parse RA "${row[Number(raCol)] || ""}".`);
      else raOut = formatRaHMS(h);
    }

    let decOut = "";
    if (decCol !== undefined) {
      const format = (mapping[Number(decCol)].format ?? "sex") as Exclude<CoordFormat, "hour">;
      const d = parseDec(row[Number(decCol)], format);
      if (d === null) warnings.push(`Row ${rowNum} (${name}): could not parse Dec "${row[Number(decCol)] || ""}".`);
      else {
        if (d < -90 || d > 90) {
          warnings.push(`Row ${rowNum} (${name}): Dec ${d.toFixed(4)}° is out of range (-90 to 90) and was clamped to ${d < 0 ? "-90" : "+90"}.`);
        }
        decOut = formatDecDMS(d);
      }
    }

    const type = typeCol !== undefined ? (row[Number(typeCol)] || "").trim() : "";
    let note = noteCol !== undefined ? (row[Number(noteCol)] || "").trim() : "";
    if (appendIgnored && ignoredCols.length) {
      const extra = ignoredCols.map((c) => row[Number(c)]).filter((v) => v && v.trim()).join(" ");
      if (extra) note = note ? `${note} ${extra}` : extra;
    }
    if (note.length > 1000) {
      note = note.slice(0, 1000);
      warnings.push(`Row ${rowNum} (${name}): note truncated to 1000 characters.`);
    }

    rows.push({ name, ra: raOut, dec: decOut, type, note });
  });

  return { rows, warnings };
}

export function buildCatalogCsv(rows: CatalogRow[]): string {
  const lines = ["name,ra,dec,type,note"];
  for (const r of rows) lines.push([r.name, r.ra, r.dec, r.type, r.note].map(csvField).join(","));
  return lines.join("\n");
}
