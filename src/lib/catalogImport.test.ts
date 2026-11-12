import { describe, it, expect } from "vitest";
import {
  parseCsvLine,
  splitLine,
  detectDelimiter,
  parseSexagesimalLoose,
  formatRaHMS,
  formatDecDMS,
  csvField,
  guessRole,
  guessCoordFormat,
  convertCatalogRows,
  buildCatalogCsv,
} from "@/lib/catalogImport";

describe("parseCsvLine", () => {
  it("splits a simple comma line", () => {
    expect(parseCsvLine("M31,00:42:44,+41:16:09")).toEqual(["M31", "00:42:44", "+41:16:09"]);
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    expect(parseCsvLine('"Nova, the bright one","she said ""wow""",ok')).toEqual([
      "Nova, the bright one",
      'she said "wow"',
      "ok",
    ]);
  });
});

describe("splitLine / detectDelimiter", () => {
  it("detects tab over comma when both could apply", () => {
    expect(detectDelimiter(["a\tb,c"])).toBe("tab");
  });
  it("falls back to whitespace when no delimiter is found", () => {
    expect(detectDelimiter(["M31 00:42:44 +41:16:09"])).toBe("ws");
    expect(splitLine("M31 00:42:44 +41:16:09", "ws")).toEqual(["M31", "00:42:44", "+41:16:09"]);
  });
});

describe("parseSexagesimalLoose", () => {
  it("parses colon, space and letter-unit separated forms", () => {
    expect(parseSexagesimalLoose("00:42:44")).toBeCloseTo(0 + 42 / 60 + 44 / 3600, 6);
    expect(parseSexagesimalLoose("05 35 17")).toBeCloseTo(5 + 35 / 60 + 17 / 3600, 6);
    expect(parseSexagesimalLoose("12h34m56s")).toBeCloseTo(12 + 34 / 60 + 56 / 3600, 6);
  });
  it("honors a leading sign", () => {
    expect(parseSexagesimalLoose("-05:23:28")).toBeCloseTo(-(5 + 23 / 60 + 28 / 3600), 6);
    expect(parseSexagesimalLoose("+41:16:09")).toBeCloseTo(41 + 16 / 60 + 9 / 3600, 6);
  });
  it("returns null for empty or garbage input", () => {
    expect(parseSexagesimalLoose("")).toBeNull();
    expect(parseSexagesimalLoose(null)).toBeNull();
    expect(parseSexagesimalLoose("not a coord")).toBeNull();
  });
});

describe("formatRaHMS / formatDecDMS", () => {
  it("formats and wraps RA hours into [0, 24)", () => {
    expect(formatRaHMS(12)).toBe("12:00:00");
    expect(formatRaHMS(-1)).toBe("23:00:00");
    expect(formatRaHMS(25)).toBe("01:00:00");
  });
  it("carries seconds/minutes rollover correctly", () => {
    // 23h59m59.6s should round up to the next hour, wrapping to 00.
    expect(formatRaHMS(23 + 59 / 60 + 59.6 / 3600)).toBe("00:00:00");
  });
  it("formats and clamps Dec degrees into [-90, 90]", () => {
    expect(formatDecDMS(41 + 16 / 60 + 9 / 3600)).toBe("+41:16:09");
    expect(formatDecDMS(-(5 + 23 / 60 + 28 / 3600))).toBe("-05:23:28");
    expect(formatDecDMS(95)).toBe("+90:00:00");
    expect(formatDecDMS(-95)).toBe("-90:00:00");
  });
});

describe("csvField", () => {
  it("leaves plain values unquoted", () => {
    expect(csvField("M31")).toBe("M31");
  });
  it("quotes and escapes values containing commas or quotes", () => {
    expect(csvField('has,comma')).toBe('"has,comma"');
    expect(csvField('has "quote"')).toBe('"has ""quote"""');
  });
});

describe("guessRole / guessCoordFormat", () => {
  it("recognizes common header names", () => {
    expect(guessRole("Name", 0, 3)).toBe("name");
    expect(guessRole("RA", 1, 3)).toBe("ra");
    expect(guessRole("Dec", 2, 3)).toBe("dec");
    expect(guessRole("Comments", 3, 4)).toBe("note");
  });
  it("falls back to position for a headerless 3- or 5-column file", () => {
    expect(guessRole("", 0, 3)).toBe("name");
    expect(guessRole("", 1, 3)).toBe("ra");
    expect(guessRole("", 2, 3)).toBe("dec");
    expect(guessRole("", 3, 5)).toBe("type");
    expect(guessRole("", 4, 5)).toBe("note");
  });
  it("guesses sexagesimal vs decimal from a sample value", () => {
    expect(guessCoordFormat("00:42:44")).toBe("sex");
    expect(guessCoordFormat("10.6847")).toBe("deg");
    expect(guessCoordFormat("")).toBe("sex");
  });
});

describe("convertCatalogRows / buildCatalogCsv", () => {
  it("converts the sample 3-column dataset from catalog-import.astro", () => {
    const rows = [
      ["M31", "00:42:44", "+41:16:09"],
      ["M42", "05:35:17", "-05:23:28"],
      ["T CrB", "15:59:30", "+25:55:13"],
    ];
    const mapping = { 0: { role: "name" as const }, 1: { role: "ra" as const, format: "sex" as const }, 2: { role: "dec" as const, format: "sex" as const } };
    const { rows: out, warnings } = convertCatalogRows(rows, mapping, false);
    expect(warnings).toEqual([]);
    expect(out).toEqual([
      { name: "M31", ra: "00:42:44", dec: "+41:16:09", type: "", note: "" },
      { name: "M42", ra: "05:35:17", dec: "-05:23:28", type: "", note: "" },
      { name: "T CrB", ra: "15:59:30", dec: "+25:55:13", type: "", note: "" },
    ]);
    expect(buildCatalogCsv(out)).toBe(
      "name,ra,dec,type,note\nM31,00:42:44,+41:16:09,,\nM42,05:35:17,-05:23:28,,\nT CrB,15:59:30,+25:55:13,,",
    );
  });

  it("converts decimal-degree RA/Dec when the column format says so", () => {
    const rows = [["Vega", "279.2346", "38.7837"]];
    const mapping = { 0: { role: "name" as const }, 1: { role: "ra" as const, format: "deg" as const }, 2: { role: "dec" as const, format: "deg" as const } };
    const { rows: out } = convertCatalogRows(rows, mapping, false);
    expect(out[0].ra).toBe(formatRaHMS(279.2346 / 15));
    expect(out[0].dec).toBe(formatDecDMS(38.7837));
  });

  it("drops rows with no name and warns on unparsable coordinates", () => {
    const rows = [["", "00:42:44", "+41:16:09"], ["Bad Coord", "not-a-ra", "+41:16:09"]];
    const mapping = { 0: { role: "name" as const }, 1: { role: "ra" as const, format: "sex" as const }, 2: { role: "dec" as const, format: "sex" as const } };
    const { rows: out, warnings } = convertCatalogRows(rows, mapping, false);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Bad Coord");
    expect(out[0].ra).toBe("");
    expect(warnings.some((w) => w.includes("could not parse RA"))).toBe(true);
  });

  it("warns when a name is over 120 characters", () => {
    const longName = "x".repeat(121);
    const rows = [[longName]];
    const mapping = { 0: { role: "name" as const } };
    const { warnings } = convertCatalogRows(rows, mapping, false);
    expect(warnings.some((w) => w.includes("over 120 characters"))).toBe(true);
  });

  it("requires a name column to be mapped", () => {
    const { rows, warnings } = convertCatalogRows([["a", "b"]], { 0: { role: "ignore" }, 1: { role: "ignore" } }, false);
    expect(rows).toEqual([]);
    expect(warnings).toEqual(['Map at least one column to "Name".']);
  });

  it("appends ignored columns to the note when requested", () => {
    const rows = [["M31", "extra info"]];
    const mapping = { 0: { role: "name" as const }, 1: { role: "ignore" as const } };
    const { rows: out } = convertCatalogRows(rows, mapping, true);
    expect(out[0].note).toBe("extra info");
  });
});
