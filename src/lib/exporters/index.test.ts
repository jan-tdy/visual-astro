import { describe, it, expect } from "vitest";
import { buildAAVSO, buildExportSummary, buildVSNET, type ExportContext, type ExportRow } from "@/lib/exporters";

const ctx: ExportContext = {
  observedAt: new Date("2026-07-15T18:00:00Z"),
  jd: 2461242.25,
  obsCode: "DPV",
};

const baseRow: ExportRow = {
  star_name: "R Cyg",
  vsnet_code: "R CYG",
  aavso_code: "RCYG",
  chart_id: "12345",
  a: "6.5",
  pasos_a: 1,
  pasos_b: 1,
  b: "7.0",
  limit_value: null,
  note: null,
  ut_time: "21:00",
};

describe("buildAAVSO", () => {
  it("strips commas from a note so columns don't shift", () => {
    const { text, skipped } = buildAAVSO([{ ...baseRow, note: "faint, uncertain" }], ctx);
    const line = text.split("\n").find((l) => l.startsWith("RCYG"));
    expect(line?.split(",")).toHaveLength(8);
    expect(line).toContain("faint  uncertain");
    expect(skipped).toEqual([]);
  });

  it("rolls a post-midnight UT observation onto the next JD", () => {
    const { text } = buildAAVSO([{ ...baseRow, ut_time: "02:15" }], ctx);
    const line = text.split("\n").find((l) => l.startsWith("RCYG"));
    const jd = parseFloat(line!.split(",")[1]);
    // 02:15 UT is ~15.75h after the 18:00 session placeholder, not before it.
    expect(jd).toBeGreaterThan(ctx.jd);
  });

  it("reports a row with no AAVSO code as skipped instead of silently dropping it", () => {
    const { text, skipped } = buildAAVSO([{ ...baseRow, aavso_code: null }], ctx);
    expect(text.trim()).toBe(
      ["#TYPE=Visual", `#OBSCODE=${ctx.obsCode}`, "#SOFTWARE=Visual-Astro (japysoft)", "#DELIM=,", "#DATE=JD", "#OBSTYPE=Visual"].join("\n"),
    );
    expect(skipped).toEqual([{ star: "R Cyg", reason: "noAavsoCode" }]);
  });

  it("reports a row with no computable magnitude as skipped", () => {
    const { skipped } = buildAAVSO([{ ...baseRow, a: null, b: null, pasos_a: null, pasos_b: null }], ctx);
    expect(skipped).toEqual([{ star: "R Cyg", reason: "noMag" }]);
  });
});

describe("buildVSNET", () => {
  it("omits rows with no computable magnitude, and reports them as skipped", () => {
    const { text, skipped } = buildVSNET([{ ...baseRow, a: null, b: null, pasos_a: null, pasos_b: null }], ctx);
    expect(text.trim()).toBe("");
    expect(skipped).toEqual([{ star: "R Cyg", reason: "noMag" }]);
  });

  it("reports a row with no VSNET code as skipped", () => {
    const { text, skipped } = buildVSNET([{ ...baseRow, vsnet_code: null }], ctx);
    expect(text.trim()).toBe("");
    expect(skipped).toEqual([{ star: "R Cyg", reason: "noVsnetCode" }]);
  });

  it("strips a line break from a note so it can't inject an extra line", () => {
    const { text } = buildVSNET([{ ...baseRow, note: "line1\nline2" }], ctx);
    expect(text.trim().split("\n")).toHaveLength(1);
  });
});

describe("buildExportSummary", () => {
  it("formats obs code + observation count, start/end UT, and outburst/active counts", () => {
    const rows: ExportRow[] = [
      { ...baseRow, ut_time: "22:42", note: null },
      { ...baseRow, ut_time: "03:45", note: "active" },
      { ...baseRow, ut_time: "23:10", note: "ACTIVE" },
    ];
    const out = buildExportSummary(rows, { obsCode: "DPV" });
    expect(out).toBe("DPV-3, start2242ut, end-0345utnxtday, outburst-0000, active-0002");
  });

  it("uppercases the observer code and counts a session that never crosses midnight", () => {
    const rows: ExportRow[] = [
      { ...baseRow, ut_time: "20:00", note: "outburst" },
      { ...baseRow, ut_time: "22:30", note: null },
    ];
    const out = buildExportSummary(rows, { obsCode: "dpv" });
    expect(out).toBe("DPV-2, start2000ut, end-2230ut, outburst-0001[R Cyg], active-0000");
  });

  it("falls back to all-zero times when no rows have a UT time", () => {
    const out = buildExportSummary([], { obsCode: "DPV" });
    expect(out).toBe("DPV-0, start0000ut, end-0000ut, outburst-0000, active-0000");
  });

  it("includes distinct outburst star names in brackets, case-insensitively, deduped", () => {
    const rows: ExportRow[] = [
      { ...baseRow, star_name: "T CrB", ut_time: "21:00", note: "OUTBURST" },
      { ...baseRow, star_name: "U Sco", ut_time: "21:30", note: "outburst" },
      { ...baseRow, star_name: "T CrB", ut_time: "22:00", note: "Outburst" },
      { ...baseRow, star_name: "R Cyg", ut_time: "22:30", note: null },
    ];
    const out = buildExportSummary(rows, { obsCode: "DPV" });
    expect(out).toBe("DPV-4, start2100ut, end-2230ut, outburst-0003[T CrB;U Sco], active-0000");
  });

  it("sanitizes star names that contain the summary's own delimiters", () => {
    const out = buildExportSummary(
      [{ ...baseRow, star_name: "T CrB, [weird]", ut_time: "21:00", note: "outburst" }],
      { obsCode: "DPV" },
    );
    expect(out).toBe("DPV-1, start2100ut, end-2100ut, outburst-0001[T CrB   weird], active-0000");
  });
});
