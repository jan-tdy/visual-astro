import { describe, it, expect } from "vitest";
import { buildColumns, type PaperTemplateLabels } from "@/lib/paperTemplatePdf";
import type { PaperTemplatePrefs } from "@/hooks/usePrefs";

const labels: PaperTemplateLabels = {
  title: "t", dateLabel: "d", observerLabel: "o",
  colNum: "#", colStar: "Hviezda", colA: "A", colPasoA: "Paso A", colPasoB: "Paso B",
  colB: "B", colMag: "Odhad", colLimit: "Limit", colUt: "UT", colNote: "Nota",
};

const col = (widthMm: number) => ({ visible: true, widthMm });

const basePrefs: PaperTemplatePrefs = {
  rows: 100,
  mergeMag: false,
  mergeLimit: false,
  columns: {
    star: col(16), a: col(8), pasoA: col(7), pasoB: col(7), b: col(8),
    mag: col(30), limit: col(10), ut: col(10), note: col(16),
  },
};

describe("buildColumns", () => {
  it("lists A/PasoA/PasoB/B/Limit as separate columns by default", () => {
    const keys = buildColumns(basePrefs, labels).map((c) => c.key);
    expect(keys).toEqual(["star", "a", "pasoA", "pasoB", "b", "limit", "ut", "note"]);
  });

  it("merges A/PasoA/PasoB/B into one 'mag' cell, keeping Limit separate", () => {
    const prefs: PaperTemplatePrefs = { ...basePrefs, mergeMag: true };
    const keys = buildColumns(prefs, labels).map((c) => c.key);
    expect(keys).toEqual(["star", "mag", "limit", "ut", "note"]);
  });

  it("folds Limit into the merged cell too when mergeLimit is on", () => {
    const prefs: PaperTemplatePrefs = { ...basePrefs, mergeMag: true, mergeLimit: true };
    const keys = buildColumns(prefs, labels).map((c) => c.key);
    expect(keys).toEqual(["star", "mag", "ut", "note"]);
  });

  it("ignores mergeLimit when mergeMag is off (Limit stays its own column)", () => {
    const prefs: PaperTemplatePrefs = { ...basePrefs, mergeMag: false, mergeLimit: true };
    const keys = buildColumns(prefs, labels).map((c) => c.key);
    expect(keys).toEqual(["star", "a", "pasoA", "pasoB", "b", "limit", "ut", "note"]);
  });

  it("drops hidden columns and carries through each column's configured width/label", () => {
    const prefs: PaperTemplatePrefs = {
      ...basePrefs,
      columns: { ...basePrefs.columns, note: { visible: false, widthMm: 16 }, limit: col(12) },
    };
    const cols = buildColumns(prefs, labels);
    expect(cols.find((c) => c.key === "note")).toBeUndefined();
    expect(cols.find((c) => c.key === "limit")).toEqual({ key: "limit", label: "Limit", width: 12 });
  });
});
