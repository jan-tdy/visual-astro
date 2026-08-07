// Type-only import: jsPDF itself is loaded on demand (see buildPaperTemplatePdf)
// so its ~450 kB doesn't bloat the app's initial bundle for users who never
// touch the paper template.
import type { jsPDF } from "jspdf";
import type { PaperTemplatePrefs } from "@/hooks/usePrefs";

export interface PaperTemplateLabels {
  title: string;
  dateLabel: string;
  observerLabel: string;
  colNum: string;
  colStar: string;
  colA: string;
  colPasoA: string;
  colPasoB: string;
  colB: string;
  colMag: string;
  colLimit: string;
  colUt: string;
  colNote: string;
}

export type Column = { key: string; label: string; width: number };

// jsPDF's built-in "helvetica" is a core PDF font restricted to WinAnsiEncoding
// (Latin-1): á/é/í/ó/ú/ý/ä render fine, but Slovak/Czech caron letters
// (ľ, č, š, ž, ť, ď, ň, ô, ĺ, ŕ — Latin Extended-A) fall outside it and come
// out as "?"/garbage. Embedding a Unicode font just for a handful of glyphs
// isn't worth the size, so those specific letters get folded to their
// undecorated base form; everything WinAnsi already supports is left as-is.
const WIN_ANSI_FALLBACK: Record<string, string> = {
  ľ: "l", Ľ: "L", ť: "t", Ť: "T", ď: "d", Ď: "D", ň: "n", Ň: "N",
  č: "c", Č: "C", š: "s", Š: "S", ž: "z", Ž: "Z", ô: "o", Ô: "O",
  ĺ: "l", Ĺ: "L", ŕ: "r", Ŕ: "R",
};
function pdfSafe(s: string): string {
  return s.replace(/[ľĽťŤďĎňŇčČšŠžŽôÔĺĹŕŔ]/g, (c) => WIN_ANSI_FALLBACK[c] ?? c);
}

/** Build the ordered, width-tagged column list a sheet block should draw, honoring merge/visibility prefs. */
export function buildColumns(prefs: PaperTemplatePrefs, labels: PaperTemplateLabels): Column[] {
  const cols: Column[] = [];
  const push = (key: string, label: string, cfg: { visible: boolean; widthMm: number }) => {
    if (cfg.visible) cols.push({ key, label, width: cfg.widthMm });
  };
  push("star", labels.colStar, prefs.columns.star);
  if (prefs.mergeMag) {
    push("mag", labels.colMag, prefs.columns.mag);
    if (!prefs.mergeLimit) push("limit", labels.colLimit, prefs.columns.limit);
  } else {
    push("a", labels.colA, prefs.columns.a);
    push("pasoA", labels.colPasoA, prefs.columns.pasoA);
    push("pasoB", labels.colPasoB, prefs.columns.pasoB);
    push("b", labels.colB, prefs.columns.b);
    push("limit", labels.colLimit, prefs.columns.limit);
  }
  push("ut", labels.colUt, prefs.columns.ut);
  push("note", labels.colNote, prefs.columns.note);
  return cols;
}

const NUM_COL_W = 6;
const HEADER_FONT_SIZE = 6.5;
const HEADER_LINE_H = 2.6; // mm per wrapped line at HEADER_FONT_SIZE

/**
 * How many lines `label` needs to wrap into at `width` mm, under the header
 * font. Column widths are user-configurable (see Settings), so a label can
 * wrap to 2+ lines — headerH is sized from this rather than assuming one.
 */
function headerLineCount(doc: jsPDF, label: string, width: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(HEADER_FONT_SIZE);
  return (doc.splitTextToSize(label, Math.max(2, width - 1)) as string[]).length;
}

function drawHeaderCell(doc: jsPDF, cx: number, yTop: number, width: number, headerH: number, label: string) {
  doc.setFillColor(235, 235, 235);
  doc.rect(cx, yTop, width, headerH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(HEADER_FONT_SIZE);
  const lines = doc.splitTextToSize(label, Math.max(2, width - 1)) as string[];
  const blockH = lines.length * HEADER_LINE_H;
  let ly = yTop + (headerH - blockH) / 2 + HEADER_LINE_H * 0.75;
  for (const line of lines) {
    doc.text(line, cx + width / 2, ly, { align: "center" });
    ly += HEADER_LINE_H;
  }
}

/**
 * Draw one ruled block (row-number column + the configured data columns) at
 * (x, yTop). Every cell is stroked individually with a real vector line, so
 * — unlike a browser print of a bordered HTML table — the grid can't be
 * silently dropped by a print driver or "fit to page" scaling.
 */
function drawBlock(
  doc: jsPDF,
  x: number,
  yTop: number,
  columns: Column[],
  numColLabel: string,
  rowStart: number,
  rowCount: number,
  rowH: number,
  headerH: number,
) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.15);

  // Header row. Fill color is re-set before every single cell — not just
  // once before the loop — because doc.text() below resets jsPDF's tracked
  // fill color to black for the glyph ink; skipping the re-set left every
  // header cell after the first one painted solid black instead of gray.
  let cx = x;
  drawHeaderCell(doc, cx, yTop, NUM_COL_W, headerH, numColLabel);
  cx += NUM_COL_W;
  for (const c of columns) {
    drawHeaderCell(doc, cx, yTop, c.width, headerH, c.label);
    cx += c.width;
  }

  // Data rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  let y = yTop + headerH;
  for (let i = 0; i < rowCount; i++) {
    let dx = x;
    doc.setFillColor(250, 250, 250);
    doc.rect(dx, y, NUM_COL_W, rowH, "FD");
    doc.text(String(rowStart + i), dx + NUM_COL_W / 2, y + rowH / 2 + 0.9, { align: "center" });
    dx += NUM_COL_W;
    for (const c of columns) {
      doc.rect(dx, y, c.width, rowH);
      dx += c.width;
    }
    y += rowH;
  }
}

function drawPageHeader(doc: jsPDF, margin: number, pageW: number, labels: PaperTemplateLabels, observer: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(labels.title, margin, margin + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const rightX = pageW - margin;
  const fieldY = margin + 4;
  const dateLineStart = rightX - 60;
  doc.text(labels.dateLabel, dateLineStart - doc.getTextWidth(labels.dateLabel) - 2, fieldY);
  doc.line(dateLineStart, fieldY, dateLineStart + 24, fieldY);

  const obsLabelX = dateLineStart + 30;
  doc.text(labels.observerLabel, obsLabelX, fieldY);
  const obsLineStart = obsLabelX + doc.getTextWidth(labels.observerLabel) + 2;
  doc.line(obsLineStart, fieldY, rightX, fieldY);
  if (observer.trim()) {
    doc.text(observer.trim(), obsLineStart + 1, fieldY - 0.8);
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(margin, margin + 6, pageW - margin, margin + 6);
}

/** Build the paper-template PDF as a jsPDF document, ready to .save() or .output(). */
export async function buildPaperTemplatePdf(
  prefs: PaperTemplatePrefs,
  labels: PaperTemplateLabels,
  observer: string,
): Promise<jsPDF> {
  const { jsPDF: JsPDFCtor } = await import("jspdf");
  const doc = new JsPDFCtor({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = 210;
  const pageH = 297;
  const margin = 8;
  const gap = 4;
  const titleH = 12;
  const rowH = 5;

  const safeLabels = Object.fromEntries(
    Object.entries(labels).map(([k, v]) => [k, pdfSafe(v)]),
  ) as unknown as PaperTemplateLabels;
  observer = pdfSafe(observer);
  labels = safeLabels;

  const columns = buildColumns(prefs, labels);
  const blockW = NUM_COL_W + columns.reduce((sum, c) => sum + c.width, 0);
  const usableW = pageW - margin * 2;
  const perPage = blockW * 2 + gap <= usableW ? 2 : 1;

  // Narrow (user-configurable) columns can wrap a header label to 2+ lines —
  // size the header row to fit whichever column needs the most lines.
  const maxHeaderLines = Math.max(
    headerLineCount(doc, labels.colNum, NUM_COL_W),
    ...columns.map((c) => headerLineCount(doc, c.label, c.width)),
  );
  const headerH = Math.max(6, maxHeaderLines * HEADER_LINE_H + 2.4);

  const usableH = pageH - margin * 2 - titleH;
  const rowsPerBlock = Math.max(1, Math.floor((usableH - headerH) / rowH));
  const rowsPerPage = rowsPerBlock * perPage;

  const totalRows = Math.max(1, Math.round(prefs.rows));
  let rowStart = 1;
  let remaining = totalRows;
  let page = 0;
  const yTop = margin + titleH;

  while (remaining > 0) {
    if (page > 0) doc.addPage();
    drawPageHeader(doc, margin, pageW, labels, observer);

    const rowsThisPage = Math.min(rowsPerPage, remaining);
    const leftRows = Math.min(rowsPerBlock, rowsThisPage);
    drawBlock(doc, margin, yTop, columns, labels.colNum, rowStart, leftRows, rowH, headerH);

    const rightRows = rowsThisPage - leftRows;
    if (rightRows > 0) {
      drawBlock(doc, margin + blockW + gap, yTop, columns, labels.colNum, rowStart + leftRows, rightRows, rowH, headerH);
    }

    rowStart += rowsThisPage;
    remaining -= rowsThisPage;
    page++;
  }

  return doc;
}
