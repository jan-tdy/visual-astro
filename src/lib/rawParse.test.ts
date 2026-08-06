import { describe, it, expect } from "vitest";
import { buildStarMatchIndex, looseDesig, matchStarToken, parseRawLine, splitConstellation } from "@/lib/rawParse";

// A miniature catalog in the same normalised form SessionEditor builds
// (lowercase, spaces stripped) from star names / VSNET / AAVSO codes.
const CATALOG = [
  "agdra",
  "mvlyr",
  "sscyg",
  "v404cyg",
  "sdss173062dra",
  "rxand",
  "uugem",
];
const index = buildStarMatchIndex(CATALOG);

describe("looseDesig", () => {
  it("drops the leading v of a variable designation", () => {
    expect(looseDesig("v404")).toBe("404");
  });
  it("keeps a leading v that is part of a letter designation", () => {
    expect(looseDesig("vw")).toBe("vw");
  });
});

describe("splitConstellation", () => {
  it("splits a designation off a known IAU abbreviation", () => {
    expect(splitConstellation("v404cyg")).toEqual({ desig: "v404", con: "cyg" });
  });
  it("returns null when the tail is not a constellation", () => {
    expect(splitConstellation("nothing")).toBeNull();
  });
});

describe("matchStarToken", () => {
  it("prefers an exact prefix and reports no correction", () => {
    const m = matchStarToken("agdraf3v1g2108", index);
    expect(m?.token).toBe("agdra");
    expect(m?.consumed).toBe(5);
    expect(m?.correction).toBeUndefined();
  });

  it("completes a truncated name", () => {
    const m = matchStarToken("sdss1730f3v1g2108", index);
    expect(m?.token).toBe("sdss173062dra");
    expect(m?.correction).toEqual({ from: "sdss1730", to: "sdss173062dra", kind: "prefix" });
  });

  it("fixes a wrong constellation on a matching designation", () => {
    const m = matchStarToken("v404herf3v1g2108", index);
    expect(m?.token).toBe("v404cyg");
    expect(m?.consumed).toBe(7);
    expect(m?.correction).toEqual({ from: "v404her", to: "v404cyg", kind: "constellation" });
  });

  it("accepts a designation with the leading v omitted", () => {
    const m = matchStarToken("404cygf3v1g2108", index);
    expect(m?.token).toBe("v404cyg");
    expect(m?.consumed).toBe(6);
    expect(m?.correction?.kind).toBe("designation");
  });

  it("resolves a truncated designation carrying the right constellation", () => {
    const m = matchStarToken("sdss1730dra12-51v312-92110", index);
    expect(m?.token).toBe("sdss173062dra");
    expect(m?.consumed).toBe(11);
  });

  it("recovers a transposed name by edit distance", () => {
    const m = matchStarToken("agdarf3v1g2108", index);
    expect(m?.token).toBe("agdra");
    expect(m?.correction?.kind).toBe("typo");
  });

  it("returns null for a star that is nowhere near the catalog", () => {
    expect(matchStarToken("qqqqqq123", index)).toBeNull();
  });

  it("does not guess when two catalog entries are equally close", () => {
    const ambiguous = buildStarMatchIndex(["v404cyg", "v404lyr"]);
    expect(matchStarToken("v404herf3v1g2108", ambiguous)).toBeNull();
  });
});

describe("parseRawLine", () => {
  it("parses letter comparators", () => {
    expect(parseRawLine("agdraf3v1g2108", index)).toMatchObject({
      starToken: "agdra", a: "f", pasos_a: 3, pasos_b: 1, b: "g", ut_time: "21:08",
    });
  });

  it("parses numeric comparators with dashes as decimal points", () => {
    expect(parseRawLine("mvlyr12-51v312-92110", index)).toMatchObject({
      starToken: "mvlyr", a: "12.5", pasos_a: 1, pasos_b: 3, b: "12.9", ut_time: "21:10",
    });
  });

  it("parses a limit line", () => {
    expect(parseRawLine("agdra<13-52108", index)).toMatchObject({
      starToken: "agdra", limit_value: "<13.5", ut_time: "21:08",
    });
  });

  it("keeps the note after '#' with its original casing", () => {
    expect(parseRawLine("agdraf3v1g2108#Hmla nizko", index)?.note).toBe("Hmla nizko");
  });

  it("counts leading '+' markers as repeat entries", () => {
    expect(parseRawLine("++agdraf3v1g2108", index)?.plusLevel).toBe(2);
  });

  it("does not guess a star name on a '+' line that only carries data", () => {
    // "s3v1g2130" starts with the same letter as sscyg/sdss…; a loose match here
    // would file the row under the wrong star instead of the previous one.
    const p = parseRawLine("+s3v1g2130", index);
    expect(p?.starToken).toBe("");
    expect(p?.plusLevel).toBe(1);
  });

  it("still accepts an explicit name on a '+' line", () => {
    expect(parseRawLine("+agdraf3v1g2130", index)?.starToken).toBe("agdra");
  });

  it("carries the star-name correction through to the caller", () => {
    const p = parseRawLine("v404herf3v1g2108", index);
    expect(p?.starToken).toBe("v404cyg");
    expect(p?.correction?.kind).toBe("constellation");
    // the data after the (mis-spelled) name must still parse correctly
    expect(p).toMatchObject({ a: "f", pasos_a: 3, pasos_b: 1, b: "g", ut_time: "21:08" });
  });

  it("returns null when no star can be resolved", () => {
    expect(parseRawLine("qqqqqq123", index)).toBeNull();
  });
});
