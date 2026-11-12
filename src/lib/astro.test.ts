import { describe, it, expect } from "vitest";
import {
  applyUtTimeToDate,
  computeMagnitude,
  formatSexagesimal,
  parseLimitMagnitude,
  parseSexagesimal,
  resolveCompValue,
} from "@/lib/astro";

describe("parseSexagesimal — plain-decimal fallback", () => {
  it("accepts in-range plain-decimal RA and Dec", () => {
    expect(parseSexagesimal("12.3456", true)).toBeCloseTo(12.3456 * 15);
    expect(parseSexagesimal("23.9999", true)).toBeCloseTo(23.9999 * 15);
    expect(parseSexagesimal("-65.4321", false)).toBeCloseTo(-65.4321);
    expect(parseSexagesimal("90", false)).toBeCloseTo(90);
  });

  it("rejects out-of-range plain-decimal RA (hours must be in [0, 24))", () => {
    expect(parseSexagesimal("24", true)).toBeNull();
    expect(parseSexagesimal("25.5", true)).toBeNull();
    expect(parseSexagesimal("-1", true)).toBeNull();
  });

  it("rejects out-of-range plain-decimal Dec (degrees must be in [-90, 90])", () => {
    expect(parseSexagesimal("90.1", false)).toBeNull();
    expect(parseSexagesimal("-91", false)).toBeNull();
    expect(parseSexagesimal("200", false)).toBeNull();
  });
});

describe("parseSexagesimal — decimal comma", () => {
  it("accepts a comma in place of the decimal point, plain or sexagesimal", () => {
    expect(parseSexagesimal("12,3456", true)).toBeCloseTo(12.3456 * 15);
    expect(parseSexagesimal("-65,4321", false)).toBeCloseTo(-65.4321);
    expect(parseSexagesimal("07 11,5", true)).toBeCloseTo((7 + 11.5 / 60) * 15);
    expect(parseSexagesimal("+65 43,5", false)).toBeCloseTo(65 + 43.5 / 60);
  });
});

describe("parseSexagesimal — seconds omitted (\"HH MM\" / \"DD MM\")", () => {
  it("parses RA given as hours and minutes only", () => {
    expect(parseSexagesimal("07 11", true)).toBeCloseTo((7 + 11 / 60) * 15);
    expect(parseSexagesimal("07:11", true)).toBeCloseTo((7 + 11 / 60) * 15);
    expect(parseSexagesimal("07h11m", true)).toBeCloseTo((7 + 11 / 60) * 15);
  });

  it("parses Dec given as degrees and minutes only", () => {
    expect(parseSexagesimal("+44 04", false)).toBeCloseTo(44 + 4 / 60);
    expect(parseSexagesimal("-44:04", false)).toBeCloseTo(-(44 + 4 / 60));
  });

  it("still parses the full H M S / D M S form", () => {
    expect(parseSexagesimal("07 11 26.0", true)).toBeCloseTo((7 + 11 / 60 + 26 / 3600) * 15);
    expect(parseSexagesimal("+44 04 05", false)).toBeCloseTo(44 + 4 / 60 + 5 / 3600);
  });
});

describe("parseSexagesimal — malformed input is rejected rather than mis-parsed", () => {
  it("rejects a unit mark that lands on the wrong component (minutes skipped)", () => {
    // "07h11s" names hours then seconds; silently reading "11" as minutes
    // would be 7h00m11s read as 7h11m00s, a real (if rare) typo to catch.
    expect(parseSexagesimal("07h11s", true)).toBeNull();
    expect(parseSexagesimal("44d11s", false)).toBeNull();
  });

  it("rejects a sign on any component but the first", () => {
    expect(parseSexagesimal("+44 -04", false)).toBeNull();
    expect(parseSexagesimal("07 -11", true)).toBeNull();
  });
});

describe("resolveCompValue — AAVSO label convention", () => {
  it("reads a decimal-less label as the magnitude with the point restored", () => {
    expect(resolveCompValue(undefined, "105")).toBe(10.5);
    expect(resolveCompValue(undefined, "79")).toBe(7.9);
    expect(resolveCompValue(undefined, "160")).toBe(16);
  });

  it("leaves an explicit decimal magnitude untouched", () => {
    expect(resolveCompValue(undefined, "13.1")).toBe(13.1);
    expect(resolveCompValue(undefined, "9.4")).toBe(9.4);
  });

  it("treats a decimal comma the same as a decimal point", () => {
    // "9,40" must be 9.4 — parseFloat alone would stop at the comma and the
    // missing "." would let the label convention rescale it.
    expect(resolveCompValue(undefined, "9,40")).toBe(9.4);
    expect(resolveCompValue(undefined, "13,1")).toBe(13.1);
    // A comma value above the threshold is still a magnitude, never rescaled.
    expect(resolveCompValue(undefined, "94,0")).toBe(94);
  });

  it("keeps a value that is already an observable magnitude", () => {
    // Anything up to ~20 is a magnitude a visual observer could actually
    // record, including genuinely bright stars, so it is read literally.
    expect(resolveCompValue(undefined, "12")).toBe(12);
    expect(resolveCompValue(undefined, "8")).toBe(8);
    expect(resolveCompValue(undefined, "3")).toBe(3);
  });

  it("rescales a value too faint to be seen through the telescope", () => {
    expect(resolveCompValue(undefined, "250")).toBe(25);
    expect(resolveCompValue(undefined, "147")).toBe(14.7);
  });

  it("honors a custom threshold (Settings: comparison-star label threshold)", () => {
    // A lower threshold means more two-digit values read as labels.
    expect(resolveCompValue(undefined, "12", 10)).toBe(1.2);
    // A higher threshold keeps a normally-rescaled value literal instead.
    expect(resolveCompValue(undefined, "25", 30)).toBe(25);
  });
});

describe("computeMagnitude", () => {
  it("interpolates T CrB from its sheet row to a real magnitude", () => {
    // "79 1V3 105" off the observing sheet: literal comparators would give
    // 85.50, which is the bug this guards against.
    expect(computeMagnitude({ a: "79", pasos_a: 1, pasos_b: 3, b: "105" }).value).toBe("8.55");
  });

  it("handles comparators written with decimal points", () => {
    expect(computeMagnitude({ a: "13.1", pasos_a: 2, pasos_b: 0, b: "13.4" }).value).toBe("13.40");
  });

  it("returns a limit as-is", () => {
    expect(computeMagnitude({ limit_value: "<16.0" }).value).toBe("<16.0");
  });

  it("normalizes a decimal comma in a limit (sk locale input)", () => {
    expect(computeMagnitude({ limit_value: "<14,9" }).value).toBe("<14.9");
  });
});

describe("parseLimitMagnitude", () => {
  it("parses a plain fainter-than string", () => {
    expect(parseLimitMagnitude("<14.9")).toBe(14.9);
  });

  it("parses without the leading '<'", () => {
    expect(parseLimitMagnitude("12.3")).toBe(12.3);
  });

  it("handles surrounding whitespace", () => {
    expect(parseLimitMagnitude(" < 9.5 ")).toBe(9.5);
  });

  it("returns null for empty or missing input", () => {
    expect(parseLimitMagnitude(null)).toBeNull();
    expect(parseLimitMagnitude(undefined)).toBeNull();
    expect(parseLimitMagnitude("")).toBeNull();
  });

  it("returns null when no number is present", () => {
    expect(parseLimitMagnitude("<")).toBeNull();
    expect(parseLimitMagnitude("n/a")).toBeNull();
  });

  it("accepts a decimal comma (sk locale input)", () => {
    expect(parseLimitMagnitude("<14,9")).toBe(14.9);
  });
});

describe("applyUtTimeToDate", () => {
  // Session date is the evening the observing night started (placeholder 18:00 UT).
  const sessionDate = () => new Date("2026-07-15T18:00:00Z");

  it("keeps the same calendar day for evening UT times", () => {
    const d = sessionDate();
    applyUtTimeToDate(d, "21:30");
    expect(d.toISOString()).toBe("2026-07-15T21:30:00.000Z");
  });

  it("rolls post-midnight UT times (00:00-11:59) onto the next calendar day", () => {
    const d = sessionDate();
    applyUtTimeToDate(d, "02:15");
    expect(d.toISOString()).toBe("2026-07-16T02:15:00.000Z");
  });

  it("does not roll at exactly noon UT", () => {
    const d = sessionDate();
    applyUtTimeToDate(d, "12:00");
    expect(d.toISOString()).toBe("2026-07-15T12:00:00.000Z");
  });

  it("does not roll at 23:59 UT", () => {
    const d = sessionDate();
    applyUtTimeToDate(d, "23:59");
    expect(d.toISOString()).toBe("2026-07-15T23:59:00.000Z");
  });

  it("accepts '.' or space as the hour/minute separator", () => {
    const d1 = sessionDate();
    applyUtTimeToDate(d1, "02.15");
    expect(d1.toISOString()).toBe("2026-07-16T02:15:00.000Z");

    const d2 = sessionDate();
    applyUtTimeToDate(d2, "02 15");
    expect(d2.toISOString()).toBe("2026-07-16T02:15:00.000Z");
  });

  it("leaves the date untouched for missing or unparseable input", () => {
    const d1 = sessionDate();
    applyUtTimeToDate(d1, null);
    expect(d1.toISOString()).toBe("2026-07-15T18:00:00.000Z");

    const d2 = sessionDate();
    applyUtTimeToDate(d2, "not a time");
    expect(d2.toISOString()).toBe("2026-07-15T18:00:00.000Z");
  });
});

describe("formatSexagesimal", () => {
  it("formats RA (decimal degrees -> HH MM SS.sss, no sign)", () => {
    expect(formatSexagesimal(15 * (18 + 36 / 60 + 56.3 / 3600), true)).toBe("18 36 56.300");
    expect(formatSexagesimal(0, true)).toBe("00 00 00.000");
  });

  it("formats Dec (decimal degrees -> ±DD MM SS.sss)", () => {
    expect(formatSexagesimal(38 + 47 / 60 + 1.3 / 3600, false)).toBe("+38 47 01.300");
    expect(formatSexagesimal(-(38 + 47 / 60 + 1.3 / 3600), false)).toBe("-38 47 01.300");
    expect(formatSexagesimal(0, false)).toBe("+00 00 00.000");
  });

  it("round-trips through parseSexagesimal", () => {
    const ra = parseSexagesimal("07 11 26.5", true)!;
    expect(formatSexagesimal(ra, true)).toBe("07 11 26.500");
    const dec = parseSexagesimal("-44 04 05.2", false)!;
    expect(formatSexagesimal(dec, false)).toBe("-44 04 05.200");
  });

  it("carries a rounded 60.000s into the next minute", () => {
    // 1.9999999 degrees of RA -> 0.1333... hours -> 00h07m59.9999... -> rounds to 08m00.000s
    expect(formatSexagesimal(1.9999999, true)).toBe("00 08 00.000");
  });

  it("rejects out-of-range RA and non-finite input", () => {
    expect(formatSexagesimal(360, true)).toBe("—");
    expect(formatSexagesimal(-1, true)).toBe("—");
    expect(formatSexagesimal(null, false)).toBe("—");
    expect(formatSexagesimal(NaN, false)).toBe("—");
  });

  it("rejects out-of-range Dec", () => {
    expect(formatSexagesimal(90.1, false)).toBe("—");
    expect(formatSexagesimal(-90.1, false)).toBe("—");
    expect(formatSexagesimal(91, false)).toBe("—");
  });

  it("accepts Dec exactly at ±90°", () => {
    expect(formatSexagesimal(90, false)).toBe("+90 00 00.000");
    expect(formatSexagesimal(-90, false)).toBe("-90 00 00.000");
  });

  it("wraps an RA that rounds up to 24h back to 00h", () => {
    // 23h59m59.9997s rounds to 24:00:00, which must wrap to 00:00:00 rather than
    // being displayed as an out-of-range "24 00 00.000".
    const almost24h = 23 + 59 / 60 + 59.9997 / 3600;
    expect(formatSexagesimal(almost24h * 15, true)).toBe("00 00 00.000");
  });
});
