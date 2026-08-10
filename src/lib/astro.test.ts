import { describe, it, expect } from "vitest";
import { applyUtTimeToDate, computeMagnitude, parseLimitMagnitude, resolveCompValue } from "@/lib/astro";

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
