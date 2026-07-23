import { describe, it, expect } from "vitest";
import { buildAAVSO, buildMEDUZA, buildVSNET, type ExportContext, type ExportRow } from "@/lib/exporters";

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
    const out = buildAAVSO([{ ...baseRow, note: "faint, uncertain" }], ctx);
    const line = out.split("\n").find((l) => l.startsWith("RCYG"));
    expect(line?.split(",")).toHaveLength(8);
    expect(line).toContain("faint  uncertain");
  });

  it("rolls a post-midnight UT observation onto the next JD", () => {
    const out = buildAAVSO([{ ...baseRow, ut_time: "02:15" }], ctx);
    const line = out.split("\n").find((l) => l.startsWith("RCYG"));
    const jd = parseFloat(line!.split(",")[1]);
    // 02:15 UT is ~15.75h after the 18:00 session placeholder, not before it.
    expect(jd).toBeGreaterThan(ctx.jd);
  });
});

describe("buildMEDUZA", () => {
  it("strips commas from the star name so columns don't shift", () => {
    const out = buildMEDUZA([{ ...baseRow, star_name: "R Cyg, faint" }], ctx);
    const dataLine = out.split("\n")[1];
    expect(dataLine.split(",")).toHaveLength(6);
  });
});

describe("buildVSNET", () => {
  it("omits rows with no computable magnitude", () => {
    const out = buildVSNET([{ ...baseRow, a: null, b: null, pasos_a: null, pasos_b: null }], ctx);
    expect(out.trim()).toBe("");
  });
});
