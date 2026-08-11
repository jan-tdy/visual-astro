import { describe, it, expect } from "vitest";
import {
  vsnetDateFromJD,
  vsnetDateToJD,
  parseVSNET,
  buildAAVSOFromVSNET,
  parseSIPS,
  buildAAVSOFromSIPS,
} from "@/lib/sips";

describe("vsnetDateToJD", () => {
  it("round-trips vsnetDateFromJD", () => {
    const jd = 2461204.898287;
    const token = vsnetDateFromJD(jd);
    expect(vsnetDateToJD(token)).toBeCloseTo(jd, 3);
  });

  it("returns null for garbage input", () => {
    expect(vsnetDateToJD("not-a-date")).toBeNull();
    expect(vsnetDateToJD("202413.5")).toBeNull();
  });
});

describe("parseVSNET", () => {
  it("parses a standard VSNET row", () => {
    const { rows, errors } = parseVSNET("DRADO    20240115.234   9.8234 DPV V");
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].mag).toBeCloseTo(9.8234, 4);
    expect(rows[0].fainterThan).toBe(false);
    expect(rows[0].filter).toBe("V");
  });

  it("recognizes a fainter-than magnitude prefixed with '<'", () => {
    const { rows } = parseVSNET("DRADO    20240115.234   <11.5 DPV V");
    expect(rows[0].fainterThan).toBe(true);
    expect(rows[0].mag).toBeCloseTo(11.5, 4);
  });

  it("ignores blank lines and comments", () => {
    const { rows, errors } = parseVSNET("# a comment\n\nDRADO 20240115.234 9.8 DPV V");
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
  });

  it("reports an error for an unparsable row", () => {
    const { rows, errors } = parseVSNET("just two tokens");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});

describe("buildAAVSOFromVSNET", () => {
  it("emits AAVSO Extended rows with the fainter-than prefix preserved", () => {
    const { rows } = parseVSNET("DRADO 20240115.234 <11.5 DPV V\nDRADO 20240116.512 9.9 DPV V");
    const text = buildAAVSOFromVSNET(rows, "DODRA", "DPV", "X12345");
    expect(text).toContain("#TYPE=Extended");
    expect(text).toContain("#OBSCODE=DPV");
    const lines = text.trim().split("\n").filter((l) => !l.startsWith("#"));
    expect(lines).toHaveLength(2);
    expect(lines[0].split(",")[0]).toBe("DODRA");
    expect(lines[0].split(",")[2]).toBe("<11.5000");
    expect(lines[0].split(",")[13]).toBe("X12345");
  });
});

describe("ASCII 3-column input reused for AAVSO output", () => {
  it("parses a headerless 3-column file and builds AAVSO Extended with a manual filter", () => {
    const parsed = parseSIPS("2461204.398287 2.4923 0.0256\n2461205.412001 2.5011 0.0201");
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.filter).toBeNull();
    const text = buildAAVSOFromSIPS(parsed.rows, "DODRA", "DPV", "V", "");
    const lines = text.trim().split("\n").filter((l) => !l.startsWith("#"));
    expect(lines).toHaveLength(2);
    expect(lines[0].split(",")[4]).toBe("V");
  });
});
