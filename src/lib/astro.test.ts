import { describe, it, expect } from "vitest";
import { applyUtTimeToDate, parseLimitMagnitude } from "@/lib/astro";

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
